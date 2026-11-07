#!/usr/bin/env python3
import hmac
import json
import os
import platform
import re
import shutil
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


TOKEN = os.environ.get("MINEFORY_AGENT_TOKEN", "")
PLATFORM = os.environ.get("MINEFORY_PLATFORM", "").lower()
SERVICE_NAME = os.environ.get("MINEFORY_SERVICE_NAME", "").strip()
PORT = int(os.environ.get("MINEFORY_AGENT_PORT", "8787"))
SERVICE_PATTERN = re.compile(r"^[A-Za-z0-9_.@-]{1,100}$")


def command_result(arguments, timeout=8):
    try:
        result = subprocess.run(arguments, capture_output=True, text=True, timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        return "timeout", 124
    except OSError:
        return "unavailable", 127
    output = result.stdout.strip() or result.stderr.strip() or ("ok" if result.returncode == 0 else "unavailable")
    return output, result.returncode


def memory_percent():
    try:
        values = {}
        with open("/proc/meminfo", encoding="utf-8") as file:
            for line in file:
                key, value = line.split(":", 1)
                values[key] = int(value.strip().split()[0])
        total = values["MemTotal"]
        available = values["MemAvailable"]
        return round((total - available) * 100 / total, 1)
    except (OSError, KeyError, ValueError, ZeroDivisionError):
        return None


def cpu_percent():
    def counters():
        with open("/proc/stat", encoding="utf-8") as file:
            values = [int(value) for value in file.readline().split()[1:]]
        return sum(values), values[3] + (values[4] if len(values) > 4 else 0)

    try:
        total_before, idle_before = counters()
        time.sleep(0.1)
        total_after, idle_after = counters()
        elapsed = total_after - total_before
        if elapsed <= 0:
            return None
        return round((elapsed - (idle_after - idle_before)) * 100 / elapsed, 1)
    except (OSError, ValueError, IndexError):
        return None


def disk_percent():
    try:
        usage = shutil.disk_usage("/")
        return round(usage.used * 100 / usage.total, 1)
    except OSError:
        return None


def uptime_seconds():
    try:
        with open("/proc/uptime", encoding="utf-8") as file:
            return int(float(file.read().split()[0]))
    except (OSError, ValueError, IndexError):
        return None


def service_status():
    if not SERVICE_NAME:
        return "not_configured"
    if PLATFORM == "ubuntu":
        output, _ = command_result(["/usr/bin/systemctl", "is-active", "--", SERVICE_NAME])
        return output
    if PLATFORM == "termux" and shutil.which("sv"):
        output, _ = command_result(["sv", "status", SERVICE_NAME])
        return output
    return "unavailable"


def run_action(action):
    if action == "status":
        return {
            "ok": True,
            "platform": PLATFORM,
            "hostname": platform.node(),
            "uptime": uptime_seconds()
        }
    if action == "resources":
        return {
            "ok": True,
            "platform": PLATFORM,
            "cpu_count": os.cpu_count(),
            "cpu_percent": cpu_percent(),
            "memory_percent": memory_percent(),
            "disk_percent": disk_percent()
        }
    if action == "service_status":
        return {"ok": True, "service_status": service_status()}
    if action == "restart_service":
        if not SERVICE_NAME:
            return {"error": "Nu este configurat un serviciu allowlist."}, 400
        if PLATFORM == "ubuntu":
            result, exit_code = command_result(["sudo", "-n", "/usr/bin/systemctl", "restart", SERVICE_NAME])
        elif PLATFORM == "termux" and shutil.which("sv"):
            result, exit_code = command_result(["sv", "restart", SERVICE_NAME])
        else:
            return {"error": "Restartul serviciilor nu este disponibil pe această platformă."}, 400
        if exit_code != 0:
            return {"error": "Restartul serviciului a eșuat sau nu este autorizat în sudoers.", "detail": result}, 502
        return {"ok": True, "message": f"Restart solicitat pentru {SERVICE_NAME}."}
    if action == "reboot":
        if PLATFORM != "ubuntu":
            return {"error": "Rebootul este disponibil doar pentru Ubuntu."}, 400
        result, exit_code = command_result(["sudo", "-n", "-l", "/usr/sbin/reboot"])
        if exit_code != 0:
            return {"error": "Rebootul nu este autorizat în sudoers.", "detail": result}, 502
        return {"ok": True, "message": "Reboot acceptat; mașina se va reporni în scurt timp."}
    return {"error": "Acțiunea nu este permisă."}, 400


class Handler(BaseHTTPRequestHandler):
    server_version = "MineforyAgent/1.0"

    def log_message(self, _format, *_args):
        return

    def send_json(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path != "/v1/action":
            self.send_json(404, {"error": "Rută inexistentă."})
            return
        supplied = self.headers.get("Authorization", "")
        expected = f"Bearer {TOKEN}"
        if not TOKEN or not hmac.compare_digest(supplied, expected):
            self.send_json(401, {"error": "Neautorizat."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "Lungimea cererii nu este validă."})
            return
        if length < 1 or length > 2048:
            self.send_json(413, {"error": "Dimensiunea cererii nu este validă."})
            return
        try:
            body = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"error": "JSON invalid."})
            return
        action = body.get("action") if isinstance(body, dict) else None
        if action not in {"status", "resources", "service_status", "restart_service", "reboot"}:
            self.send_json(400, {"error": "Acțiunea nu este permisă."})
            return
        if body.get("service_name") != (SERVICE_NAME or None):
            self.send_json(400, {"error": "Serviciul nu corespunde configurației agentului."})
            return
        result = run_action(action)
        if isinstance(result, tuple):
            payload, status = result
            self.send_json(status, payload)
            return
        if action == "reboot":
            self.send_json(202, result)
            threading.Thread(target=self.delayed_reboot, daemon=True).start()
            return
        self.send_json(200, result)

    @staticmethod
    def delayed_reboot():
        time.sleep(1)
        command_result(["sudo", "-n", "/usr/sbin/reboot"], timeout=3)


def main():
    if len(TOKEN) < 32:
        raise SystemExit("Setează MINEFORY_AGENT_TOKEN la un token aleatoriu de cel puțin 32 de caractere.")
    if PLATFORM not in {"ubuntu", "termux"}:
        raise SystemExit("Setează MINEFORY_PLATFORM la ubuntu sau termux.")
    if SERVICE_NAME and not SERVICE_PATTERN.fullmatch(SERVICE_NAME):
        raise SystemExit("MINEFORY_SERVICE_NAME conține caractere nepermise.")
    if not 1024 <= PORT <= 65535:
        raise SystemExit("MINEFORY_AGENT_PORT trebuie să fie între 1024 și 65535.")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Minefory agent ascultă doar local pe 127.0.0.1:{PORT}.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
