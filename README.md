# Minefory Host

The project has a React panel and a Node.js API that downloads Minecraft server JARs, stores each account's server files separately, and starts/stops Java server processes.

## Requirements

- Node.js 20 or newer
- A Supabase project with Email authentication enabled
- Java runtimes installed on the host for the versions you plan to use

## Local setup

1. Copy `.env.example` to `.env`.
2. The provided `.env.example` is prefilled with this project's Supabase URL, publishable key, and administrator email. Use `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_ADMIN_EMAIL` for the frontend; use `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `ADMIN_EMAIL` for the API. Never use `SUPABASE_SECRET_KEY` or a `service_role` key.
3. Keep `API_HOST=127.0.0.1` for local development. Set `ALLOWED_ORIGINS=http://localhost:5173`.
4. Configure Java executable paths (for example `JAVA_21_PATH=C:\Program Files\Eclipse Adoptium\jdk-21\bin\java.exe`). The selected Java version is checked before starting a server.
5. In Supabase, create the Owner account matching `ADMIN_EMAIL` / `VITE_ADMIN_EMAIL`. To allow sign-in without confirming the address, turn off **Confirm email** for the Email provider in Supabase Authentication settings. This is a Supabase project setting and cannot be changed by this app's publishable key.
6. Public registration is not shown. Disable public signups in Supabase under **Authentication → Settings**. The Owner or a Co-owner can grant panel access to an email with an existing Supabase account; the API verifies that the account predates the access grant.
7. Install dependencies and run the frontend and API in separate terminals:

   ```sh
   npm install
   npm run api
   npm run dev
   ```

Vite proxies `/api` to the local API. Server data and JARs are stored under `data/` and are excluded from Git.
The administrator email is public configuration, not a password. Set or reset its password through Supabase; never put the password in `.env.example`, frontend code, or Git.

### Team access and roles

The API persists team access in `DATA_DIR/access-control.json`. The Owner is the Supabase account whose email matches `ADMIN_EMAIL`; its identity is fixed after its first sign-in and cannot be changed through team management.

- **Owner:** all panel and server permissions; the Owner account cannot be edited or removed by team management.
- **Co-owner:** full panel and server access, including creating/deleting servers and managing team access.
- **Developer:** can view, create, configure, start/stop servers, use the console, and manage files; cannot delete servers or manage team access.
- **Member:** can access only assigned servers and the selected permissions: view, manage servers, console, files, and/or delete. Viewing assigned servers is required.

Add team emails only after their Supabase accounts exist. Existing accounts must have been created before access is granted; a later-created account with the same address is rejected. Adding access does not create an account or send an invitation. The user signs in with their own Supabase credentials. Role checks and server scoping are enforced by the API, not only by hidden panel controls.

## Remote deployment

- Put the API behind a reverse proxy with HTTPS. Keep the Node API bound to `127.0.0.1`; do not expose it directly to the public internet.
- Set `ALLOWED_ORIGINS` to the exact HTTPS origin of the panel and set the frontend `VITE_API_URL` to the API's HTTPS origin at build time.
- Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ADMIN_EMAIL`, `DATA_DIR`, `MINECRAFT_HOST`, and Java paths on the API host. Keep `DATA_DIR` on a persistent volume: it stores access assignments, server metadata, JARs, worlds, and configuration files. Losing or replacing that volume loses those records and files. The publishable key can be used to validate Supabase sessions; never use a `SUPABASE_SECRET_KEY` or `service_role` key in the browser or API config.
- Configure Supabase's Site URL and allowed redirect URLs for the deployed panel. Configure SMTP for confirmation and password-recovery mail.
- Open the allocated Minecraft TCP port range (25565-25664) in the host firewall and set `MINECRAFT_HOST` to the address players should use.

### Node.js hosting panel / Egg

The `.env` file does not install or start the API, and you do not need to upload it to the host. Upload the project files to the Node.js service's working directory (the directory containing `package.json`), install dependencies with `npm install`, and use `npm run api` as its startup command. In the hosting panel, add the API settings as environment variables for the Node.js service; the API reads these directly from `process.env`. Set `DATA_DIR` to the persistent volume's mount path (`databazesecret` in this setup); if the panel expects an absolute container path, use the absolute mount path shown in its volume settings. A local `.env` is only for local development.

Set the Node service's `HOST` to `0.0.0.0` and `PORT` to the port allocated by the hosting panel. These standard variables take precedence over `API_HOST` and `API_PORT`. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ADMIN_EMAIL`, `ALLOWED_ORIGINS` (the exact HTTPS origin of the panel UI), `DATA_DIR`, `MINECRAFT_HOST`, and the required Java paths in the Node service's environment settings. When building the frontend, set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ADMIN_EMAIL`, and `VITE_API_URL` to the corresponding project, admin email, and API values. Only the publishable key and admin email belong in frontend build settings; never put a Supabase secret/service-role key in the frontend or Git. The example file's localhost values are for local development and must be changed for a remote deployment. The browser cannot call a plain HTTP API from an HTTPS panel; if the host does not provide HTTPS for the API, use a reverse proxy with TLS or host the API on a VPS you control.

The API stores server metadata, JARs, worlds, and server files under `DATA_DIR`. Keep that directory mounted on persistent storage and do not delete or replace the volume when redeploying. Account emails and passwords are handled by Supabase Auth; passwords are never saved in this server data directory or stored by the API.

Keep the API in its own persistent Node.js service, not inside a Minecraft server's Java startup process. The API starts Java child processes itself and needs the selected Java executable plus allocated Minecraft ports. Verify the hosting provider permits this before using it as a game-server host.

## API
Team server operations use the Owner's host storage, while Members can reach only their explicitly assigned server IDs. API authorization enforces these rules regardless of what the frontend displays.

All server endpoints except `/api/health` require `Authorization: Bearer <Supabase access token>`. The API validates the token with Supabase and scopes server IDs and files to the authenticated user.

- `GET /api/servers` — list the caller's servers
- `GET /api/access/me` — resolve the caller's effective role and permissions
- `GET`, `POST /api/access/members` and `PATCH`, `DELETE /api/access/members/:email` — manage team access (Owner/Co-owner only)
- `POST /api/servers` — download and checksum-verify the selected official Vanilla or Paper `server.jar`
- `GET`, `PATCH`, `DELETE /api/servers/:id` — inspect, configure (while stopped), or delete a server
- `POST /api/servers/:id/start`, `/stop`, `/restart`, `/command` — manage the Java process
- `GET /api/servers/:id/logs` — read process output; `DELETE` clears it
- `GET /api/servers/:id/files` and `/files/:path` — list/read safe text configuration files; `POST` creates and `PUT` edits files

Starting a server requires the user to accept the Minecraft EULA in its settings and the selected Java runtime to be installed. Vanilla JARs come from Mojang's official manifest; Paper JARs come from PaperMC's v3 API. Both downloads are checksum-verified.

The API limits each account to 5 servers and 32 GB of configured RAM across those servers.

The plugin catalog is still a UI selection only; it does not download third-party plugin JARs. This API manages Minecraft server files/processes but does not replace a production isolation layer such as Pterodactyl/Wings or containers. Run it only on a host you control, use HTTPS remotely, and keep server data backed up.
