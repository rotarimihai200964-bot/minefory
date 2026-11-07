# Minefory Host Workspace

Minefory is an authenticated dashboard for managing authorized Ubuntu Linux and Termux hosts. It includes Owner/Co-owner roles, custom workspace sections, an Ubuntu/Termux host inventory, and a small host agent for explicitly allowlisted actions. It no longer opens or manages a Pterodactyl panel.

## What host actions are supported

- Read host status and uptime.
- Read CPU, memory, and disk usage.
- Check the one service configured on a host.
- Restart that configured service.
- Reboot an Ubuntu host after an explicit confirmation.

There is no web terminal and no arbitrary command field. Termux reboot is not supported. Service restart and reboot require the narrowly scoped sudo permissions described below. Only install the agent on machines you own or are explicitly authorized to administer.

## Local frontend

Requirements: Node.js 20+ and a Supabase project with Google OAuth enabled. Email/Password authentication remains available as a fallback.

1. Copy `.env.example` to `.env` if needed.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`. These are frontend configuration values; never put a Supabase secret/service-role key in the browser or Git.
3. Run `npm install` and `npm run dev`.
4. Open the local URL printed by Vite.

`.env` is ignored by Git. Never upload it to GitHub.

## Supabase setup

1. In the Supabase SQL Editor, run [`supabase/migrations/202611070001_minefory_workspace.sql`](./supabase/migrations/202611070001_minefory_workspace.sql).
2. In **Authentication → Sign In / Providers → Google**, enable Google and add the OAuth client ID and secret from Google Cloud Console. Set the Google OAuth redirect URI to `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`. In **Authentication → URL Configuration**, allow the production URL `https://minefory.pages.dev` and your local development URL. Never put the Google client secret in the frontend.
3. Sign in once with the Google account that should own Minefory, then run this SQL in the Supabase SQL Editor after replacing the email with that Google account's email:

   ```sql
   insert into public.minefory_members (email, role)
   select lower(email), 'owner'
   from auth.users
   where lower(email) = lower('owner@example.com')
   on conflict (email) do update
     set role = 'owner'
     where public.minefory_members.role = 'co_owner';
   ```

4. The Owner can add Co-owners from **Rankuri**; each Co-owner should sign in with Google once before being granted a role. Public workspace access is not available.
5. In Cloudflare Pages, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the build and deploy again. Keep `.env` local; do not commit it.
6. Deploy the Supabase Edge Function:

   ```sh
   supabase functions deploy host-action --project-ref YOUR_PROJECT_REF
   ```

   The function uses Supabase's server-side `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` environment values. The service-role key must remain server-side.

If login succeeds but Minefory displays **Nu ai acces la workspace**, first verify that the migration above ran successfully and that the signed-in email appears in `public.minefory_members` with the `owner` or `co_owner` role. The Owner insert statement above adds the first authorized account. The page now shows Supabase lookup errors directly when the membership table or its policies are missing.

Row Level Security protects workspace data. Owner can add/remove Co-owners; Owner and Co-owner can manage hosts and custom sections. The machine-agent tokens are stored in a separate table that authenticated browser clients cannot read.

## Install a host agent

The agent listens only on `127.0.0.1:8787`. Use an HTTPS tunnel such as Cloudflare Tunnel to reach it; do not expose port 8787 directly to the Internet. Generate a unique token on each host:

```sh
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Keep the token on the host and enter the same token when registering that machine in **Admin Panel**. The browser sends it to the authenticated Edge Function over HTTPS; the function stores it server-side and never returns it to the browser.

### Ubuntu Linux

Install Python 3, then start `host-agent/agent.py` with these environment variables:

```sh
export MINEFORY_AGENT_TOKEN='GENERATED_RANDOM_TOKEN'
export MINEFORY_PLATFORM=ubuntu
export MINEFORY_SERVICE_NAME='minefory.service'
python3 host-agent/agent.py
```

For service restart and reboot, run the agent as a dedicated unprivileged user and grant only these exact commands with `sudo visudo -f /etc/sudoers.d/minefory-agent` (replace the account and service name):

```text
minefory-agent ALL=(root) NOPASSWD: /usr/bin/systemctl restart minefory.service, /usr/sbin/reboot
```

Set the sudoers file permissions to `0440`. Do not run the agent as root and do not grant broad sudo permissions.

### Termux

Install `python` and `termux-services`, then start the agent:

```sh
pkg install python termux-services
export MINEFORY_AGENT_TOKEN='GENERATED_RANDOM_TOKEN'
export MINEFORY_PLATFORM=termux
export MINEFORY_SERVICE_NAME='your-allowlisted-service'
python host-agent/agent.py
```

Termux supports status and resource checks. Service status/restart are available when `termux-services` is installed and a service name is configured. Reboot is intentionally unavailable.

When adding the host in Minefory, enter the HTTPS address of its tunnel, its platform, the configured service name (required for Ubuntu; optional for Termux), and the same agent token. The endpoint must be reachable from Supabase Edge Functions.

## Cloudflare Pages build

- Build command: `npm run build`
- Build output directory: `dist`

The dashboard frontend and Supabase Edge Function are separate deployments. A successful Pages build does not deploy the Edge Function or install host agents.
# Minefory Host Workspace

Minefory is an authenticated dashboard for managing authorized Ubuntu Linux and Termux hosts. It includes Owner/Co-owner roles, custom workspace sections, an Ubuntu/Termux host inventory, and a small host agent for explicitly allowlisted actions. It no longer opens or manages a Pterodactyl panel.

## What host actions are supported

- Read host status and uptime.
- Read CPU, memory, and disk usage.
- Check the one service configured on a host.
- Restart that configured service.
- Reboot an Ubuntu host after an explicit confirmation.

There is no web terminal and no arbitrary command field. Termux reboot is not supported. Service restart and reboot require the narrowly scoped sudo permissions described below. Only install the agent on machines you own or are explicitly authorized to administer.

## Local frontend

Requirements: Node.js 20+ and a Supabase project with Email/Password authentication enabled.

1. Copy `.env.example` to `.env` if needed.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`. These are frontend configuration values; never put a Supabase secret/service-role key in the browser or Git.
3. Run `npm install` and `npm run dev`.
4. Open the local URL printed by Vite.

`.env` is ignored by Git. Never upload it to GitHub.

## Supabase setup

1. In the Supabase SQL Editor, run [`supabase/migrations/202611070001_minefory_workspace.sql`](./supabase/migrations/202611070001_minefory_workspace.sql).
2. Create the Owner account in Supabase Authentication, then run this SQL after replacing the email with that account's email:

   ```sql
   insert into public.minefory_members (email, role)
   select lower(email), 'owner'
   from auth.users
   where lower(email) = lower('owner@example.com')
   on conflict (email) do update
     set role = 'owner'
     where public.minefory_members.role = 'co_owner';
   ```

3. Create each Co-owner account in Supabase Authentication. The Owner can then grant that account the `Co-owner` role from **Rankuri**. Public registration is not available in Minefory.
4. In Cloudflare Pages, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the build and deploy again. Keep `.env` local; do not commit it.
5. Deploy the Supabase Edge Function:

   ```sh
   supabase functions deploy host-action --project-ref YOUR_PROJECT_REF
   ```

   The function uses Supabase's server-side `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` environment values. The service-role key must remain server-side.

Row Level Security protects workspace data. Owner can add/remove Co-owners; Owner and Co-owner can manage hosts and custom sections. The machine-agent tokens are stored in a separate table that authenticated browser clients cannot read.

## Install a host agent

The agent listens only on `127.0.0.1:8787`. Use an HTTPS tunnel such as Cloudflare Tunnel to reach it; do not expose port 8787 directly to the Internet. Generate a unique token on each host:

```sh
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Keep the token on the host and enter the same token when registering that machine in **Admin Panel**. The browser sends it to the authenticated Edge Function over HTTPS; the function stores it server-side and never returns it to the browser.

### Ubuntu Linux

Install Python 3, then start `host-agent/agent.py` with these environment variables:

```sh
export MINEFORY_AGENT_TOKEN='GENERATED_RANDOM_TOKEN'
export MINEFORY_PLATFORM=ubuntu
export MINEFORY_SERVICE_NAME='minefory.service'
python3 host-agent/agent.py
```

For service restart and reboot, run the agent as a dedicated unprivileged user and grant only these exact commands with `sudo visudo -f /etc/sudoers.d/minefory-agent` (replace the account and service name):

```text
minefory-agent ALL=(root) NOPASSWD: /usr/bin/systemctl restart minefory.service, /usr/sbin/reboot
```

Set the sudoers file permissions to `0440`. Do not run the agent as root and do not grant broad sudo permissions.

### Termux

Install `python` and `termux-services`, then start the agent:

```sh
pkg install python termux-services
export MINEFORY_AGENT_TOKEN='GENERATED_RANDOM_TOKEN'
export MINEFORY_PLATFORM=termux
export MINEFORY_SERVICE_NAME='your-allowlisted-service'
python host-agent/agent.py
```

Termux supports status and resource checks. Service status/restart are available when `termux-services` is installed and a service name is configured. Reboot is intentionally unavailable.

When adding the host in Minefory, enter the HTTPS address of its tunnel, its platform, the configured service name (required for Ubuntu; optional for Termux), and the same agent token. The endpoint must be reachable from Supabase Edge Functions.

## Cloudflare Pages build

- Build command: `npm run build`
- Build output directory: `dist`

The dashboard frontend and Supabase Edge Function are separate deployments. A successful Pages build does not deploy the Edge Function or install host agents.
