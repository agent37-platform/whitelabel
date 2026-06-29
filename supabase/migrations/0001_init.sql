create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null check (role = 'admin'),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.invitations (
  token        uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  role         text not null check (role = 'admin'),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days'
);

create table if not exists public.agents (
  agent37_id   text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text,
  status       text,
  template     text,
  cpu          integer,
  memory       integer,
  disk         integer,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists agents_workspace_idx on public.agents (workspace_id);
create index if not exists memberships_user_idx on public.memberships (user_id);

-- SECURITY DEFINER so they bypass RLS (no policy recursion).
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.memberships
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(ws uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.memberships
    where workspace_id = ws and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.memberships (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'admin')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- Reads auth.users for member emails, so it stays SECURITY DEFINER. Authorization (caller must be
-- a member of p_workspace) is enforced by the server BFF (requireMember) before this is called —
-- the server uses the service-role key, under which auth.uid() is NULL, so the check can't live here.
create or replace function public.get_workspace_members(p_workspace uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select m.user_id, u.email::text, m.role, m.created_at
    from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace
    order by m.created_at;
end;
$$;

create or replace function public.get_invitation(p_token uuid)
returns table (workspace_id uuid, workspace_name text, role text, expired boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select i.workspace_id, w.name, i.role, (i.expires_at < now())
    from public.invitations i
    join public.workspaces w on w.id = i.workspace_id
    where i.token = p_token;
end;
$$;

-- Takes the caller's id as p_user (the server passes the verified session user.id): under the
-- service-role key auth.uid() is NULL, so it can't be read from the JWT here.
create or replace function public.accept_invitation(p_token uuid, p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations%rowtype;
begin
  select * into v_inv from public.invitations where token = p_token;
  if not found then
    raise exception 'invitation not found';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'invitation expired';
  end if;
  insert into public.memberships (workspace_id, user_id, role)
  values (v_inv.workspace_id, p_user, v_inv.role)
  on conflict (workspace_id, user_id) do update set role = excluded.role;
  delete from public.invitations where token = p_token;
  return v_inv.workspace_id;
end;
$$;

alter table public.workspaces  enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.agents      enable row level security;

-- The owner_id arm matters: create does `insert ... returning *`, which also runs
-- the SELECT policy on the new row before the AFTER-INSERT trigger adds membership.
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select using (public.is_workspace_member(id) or owner_id = auth.uid());

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
  for insert with check (owner_id = auth.uid());

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));

drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
  for delete using (owner_id = auth.uid());

drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists memberships_insert on public.memberships;
create policy memberships_insert on public.memberships
  for insert with check (public.is_workspace_admin(workspace_id));

drop policy if exists memberships_update on public.memberships;
create policy memberships_update on public.memberships
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships
  for delete using (public.is_workspace_admin(workspace_id) or user_id = auth.uid());

drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations
  for select using (public.is_workspace_admin(workspace_id));

drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations
  for insert with check (public.is_workspace_admin(workspace_id));

drop policy if exists invitations_delete on public.invitations;
create policy invitations_delete on public.invitations
  for delete using (public.is_workspace_admin(workspace_id));

drop policy if exists agents_select on public.agents;
create policy agents_select on public.agents
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists agents_insert on public.agents;
create policy agents_insert on public.agents
  for insert with check (public.is_workspace_admin(workspace_id));

drop policy if exists agents_update on public.agents;
create policy agents_update on public.agents
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists agents_delete on public.agents;
create policy agents_delete on public.agents
  for delete using (public.is_workspace_admin(workspace_id));

-- Access model: clients (the browser's anon key + a user's JWT, i.e. the anon/authenticated roles)
-- get NO direct table or data-RPC access. Every read and write goes through this app's Next.js
-- server using the service-role key, which authorizes each call in TypeScript (src/lib/auth.ts)
-- first. The RLS policies above are kept enabled only as a backstop — they're dormant because the
-- client roles have no grants to reach the tables, and the service role bypasses RLS.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete
  on public.workspaces, public.memberships, public.invitations, public.agents
  to service_role;

grant execute on function public.get_workspace_members(uuid)          to service_role;
grant execute on function public.get_invitation(uuid)                 to service_role;
grant execute on function public.accept_invitation(uuid, uuid)        to service_role;
