# Minefory Host

The project has a React panel and a Node.js API that downloads Minecraft server JARs, stores each account's server files separately, and starts/stops Java server processes.

## Requirements

- Node.js 20 or newer
- A Supabase project with Email authentication enabled
- Java runtimes installed on the host for the versions you plan to use

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase **Project Settings → API**. Set the same values for `SUPABASE_URL` and `SUPABASE_ANON_KEY` for the API.
3. Keep `API_HOST=127.0.0.1` for local development. Set `ALLOWED_ORIGINS=http://localhost:5173`.
4. Configure Java executable paths (for example `JAVA_21_PATH=C:\Program Files\Eclipse Adoptium\jdk-21\bin\java.exe`). The selected Java version is checked before starting a server.
5. Install dependencies and run the frontend and API in separate terminals:

   ```sh
   npm install
   npm run api
   npm run dev
   ```

Vite proxies `/api` to the local API. Server data and JARs are stored under `data/` and are excluded from Git.

## Remote deployment

- Put the API behind a reverse proxy with HTTPS. Keep the Node API bound to `127.0.0.1`; do not expose it directly to the public internet.
- Set `ALLOWED_ORIGINS` to the exact HTTPS origin of the panel and set the frontend `VITE_API_URL` to the API's HTTPS origin at build time.
- Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATA_DIR`, `MINECRAFT_HOST`, and Java paths on the API host. The public anon key can be used to validate Supabase sessions; never use a `service_role` key in the browser or API config for this integration.
- Configure Supabase's Site URL and allowed redirect URLs for the deployed panel. Configure SMTP for confirmation and password-recovery mail.
- Open the allocated Minecraft TCP port range (25565-25664) in the host firewall and set `MINECRAFT_HOST` to the address players should use.

## API

All server endpoints except `/api/health` require `Authorization: Bearer <Supabase access token>`. The API validates the token with Supabase and scopes server IDs and files to the authenticated user.

- `GET /api/servers` — list the caller's servers
- `POST /api/servers` — download and checksum-verify the selected official Vanilla or Paper `server.jar`
- `GET`, `PATCH`, `DELETE /api/servers/:id` — inspect, configure (while stopped), or delete a server
- `POST /api/servers/:id/start`, `/stop`, `/restart`, `/command` — manage the Java process
- `GET /api/servers/:id/logs` — read process output; `DELETE` clears it
- `GET /api/servers/:id/files` and `/files/:path` — list/read safe text configuration files; `POST` creates and `PUT` edits files

Starting a server requires the user to accept the Minecraft EULA in its settings and the selected Java runtime to be installed. Minecraft/Paper JAR downloads are retrieved from their official services and checksum-verified.

The API limits each account to 5 servers and 32 GB of configured RAM across those servers.

The plugin catalog is still a UI selection only; it does not download third-party plugin JARs. This API manages Minecraft server files/processes but does not replace a production isolation layer such as Pterodactyl/Wings or containers. Run it only on a host you control, use HTTPS remotely, and keep server data backed up.
