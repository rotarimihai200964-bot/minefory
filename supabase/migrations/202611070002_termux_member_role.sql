alter table public.minefory_members
  drop constraint if exists minefory_members_role_check;

alter table public.minefory_members
  add constraint minefory_members_role_check
  check (role in ('owner', 'co_owner', 'termux_member'));

drop policy if exists "owner can add co-owners" on public.minefory_members;
create policy "owner can add workspace members"
on public.minefory_members for insert to authenticated
with check (
  public.minefory_current_role() = 'owner'
  and role in ('co_owner', 'termux_member')
);

drop policy if exists "owner can update co-owners" on public.minefory_members;
create policy "owner can update workspace members"
on public.minefory_members for update to authenticated
using (
  public.minefory_current_role() = 'owner'
  and role in ('co_owner', 'termux_member')
)
with check (
  public.minefory_current_role() = 'owner'
  and role in ('co_owner', 'termux_member')
);

drop policy if exists "owner can remove co-owners" on public.minefory_members;
create policy "owner can remove workspace members"
on public.minefory_members for delete to authenticated
using (
  public.minefory_current_role() = 'owner'
  and role in ('co_owner', 'termux_member')
);

drop policy if exists "members can view machines" on public.minefory_machines;
create policy "workspace roles can view permitted machines"
on public.minefory_machines for select to authenticated
using (
  public.minefory_current_role() in ('owner', 'co_owner')
  or (
    public.minefory_current_role() = 'termux_member'
    and platform = 'termux'
  )
);

drop policy if exists "members can add machines" on public.minefory_machines;
create policy "workspace roles can add permitted machines"
on public.minefory_machines for insert to authenticated
with check (
  public.minefory_current_role() in ('owner', 'co_owner')
  or (
    public.minefory_current_role() = 'termux_member'
    and platform = 'termux'
  )
);

drop policy if exists "members can update machines" on public.minefory_machines;
create policy "workspace roles can update permitted machines"
on public.minefory_machines for update to authenticated
using (
  public.minefory_current_role() in ('owner', 'co_owner')
  or (
    public.minefory_current_role() = 'termux_member'
    and platform = 'termux'
  )
)
with check (
  public.minefory_current_role() in ('owner', 'co_owner')
  or (
    public.minefory_current_role() = 'termux_member'
    and platform = 'termux'
  )
);

drop policy if exists "members can remove machines" on public.minefory_machines;
create policy "workspace roles can remove permitted machines"
on public.minefory_machines for delete to authenticated
using (
  public.minefory_current_role() in ('owner', 'co_owner')
  or (
    public.minefory_current_role() = 'termux_member'
    and platform = 'termux'
  )
);
