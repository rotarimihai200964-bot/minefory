create table if not exists public.minefory_members (
  email text primary key check (email = lower(trim(email))),
  role text not null check (role in ('owner', 'co_owner')),
  created_at timestamptz not null default now()
);

create table if not exists public.minefory_machines (
  id uuid primary key,
  name text not null check (char_length(trim(name)) between 1 and 60),
  platform text not null check (platform in ('ubuntu', 'termux')),
  endpoint text not null,
  service_name text,
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (endpoint ~ '^https://[^[:space:]]+$'),
  check (service_name is null or service_name ~ '^[A-Za-z0-9_.@-]{1,100}$'),
  check (platform <> 'ubuntu' or service_name is not null)
);

create table if not exists public.minefory_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  description text not null check (char_length(trim(description)) between 1 and 300),
  url text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (url is null or url ~ '^https?://[^[:space:]]+$')
);

create table if not exists public.minefory_machine_credentials (
  machine_id uuid primary key references public.minefory_machines(id) on delete cascade,
  agent_token text not null check (char_length(agent_token) >= 32),
  updated_at timestamptz not null default now()
);

alter table public.minefory_members enable row level security;
alter table public.minefory_machines enable row level security;
alter table public.minefory_sections enable row level security;
alter table public.minefory_machine_credentials enable row level security;

create or replace function public.minefory_current_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role
  from public.minefory_members
  where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1
$$;

revoke all on function public.minefory_current_role() from public, anon;
grant execute on function public.minefory_current_role() to authenticated;

create or replace function public.minefory_protect_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.role = 'owner' then
    raise exception 'Owner membership cannot be changed or deleted';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists minefory_protect_owner on public.minefory_members;
create trigger minefory_protect_owner
before update or delete on public.minefory_members
for each row execute function public.minefory_protect_owner();

drop policy if exists "members can view workspace members" on public.minefory_members;
create policy "members can view workspace members"
on public.minefory_members for select to authenticated
using (public.minefory_current_role() in ('owner', 'co_owner'));

drop policy if exists "owner can add co-owners" on public.minefory_members;
create policy "owner can add co-owners"
on public.minefory_members for insert to authenticated
with check (public.minefory_current_role() = 'owner' and role = 'co_owner');

drop policy if exists "owner can update co-owners" on public.minefory_members;
create policy "owner can update co-owners"
on public.minefory_members for update to authenticated
using (public.minefory_current_role() = 'owner' and role = 'co_owner')
with check (role = 'co_owner');

drop policy if exists "owner can remove co-owners" on public.minefory_members;
create policy "owner can remove co-owners"
on public.minefory_members for delete to authenticated
using (public.minefory_current_role() = 'owner' and role = 'co_owner');

drop policy if exists "members can view machines" on public.minefory_machines;
create policy "members can view machines"
on public.minefory_machines for select to authenticated
using (public.minefory_current_role() in ('owner', 'co_owner'));

drop policy if exists "members can add machines" on public.minefory_machines;
create policy "members can add machines"
on public.minefory_machines for insert to authenticated
with check (public.minefory_current_role() in ('owner', 'co_owner'));

drop policy if exists "members can update machines" on public.minefory_machines;
create policy "members can update machines"
on public.minefory_machines for update to authenticated
using (public.minefory_current_role() in ('owner', 'co_owner'))
with check (public.minefory_current_role() in ('owner', 'co_owner'));

drop policy if exists "members can remove machines" on public.minefory_machines;
create policy "members can remove machines"
on public.minefory_machines for delete to authenticated
using (public.minefory_current_role() in ('owner', 'co_owner'));

drop policy if exists "members can view custom sections" on public.minefory_sections;
create policy "members can view custom sections"
on public.minefory_sections for select to authenticated
using (public.minefory_current_role() in ('owner', 'co_owner'));

drop policy if exists "members can add custom sections" on public.minefory_sections;
create policy "members can add custom sections"
on public.minefory_sections for insert to authenticated
with check (public.minefory_current_role() in ('owner', 'co_owner'));

drop policy if exists "members can remove custom sections" on public.minefory_sections;
create policy "members can remove custom sections"
on public.minefory_sections for delete to authenticated
using (public.minefory_current_role() in ('owner', 'co_owner'));

revoke all on public.minefory_machine_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.minefory_members to authenticated;
grant select, insert, update, delete on public.minefory_machines to authenticated;
grant select, insert, delete on public.minefory_sections to authenticated;
grant select, insert, update, delete on public.minefory_members to service_role;
grant select, insert, update, delete on public.minefory_machines to service_role;
grant select, insert, update, delete on public.minefory_sections to service_role;
grant select, insert, update, delete on public.minefory_machine_credentials to service_role;
