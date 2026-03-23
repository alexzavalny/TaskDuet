create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, invite_code)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Anonymous'),
    upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6))
  );

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  invite_code text not null unique,
  active_pair_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pairs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  status text not null default 'active' check (status in ('active')),
  created_at timestamptz not null default now()
);

create table if not exists public.pair_members (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  slot text null check (slot in ('left', 'right') or slot is null),
  joined_at timestamptz not null default now(),
  unique (pair_id, profile_id),
  unique (profile_id)
);

alter table public.profiles
  add constraint profiles_active_pair_id_fkey
  foreign key (active_pair_id) references public.pairs(id)
  on delete set null;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  period_type text not null check (period_type in ('day', 'week', 'month')),
  period_anchor_date date not null,
  completed boolean not null default false,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

create or replace function public.is_member_of_pair(target_pair_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.pair_members pm
    where pm.pair_id = target_pair_id
      and pm.profile_id = auth.uid()
  );
$$;

create or replace function public.create_pair_with_invite(invite_code_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
  partner_profile public.profiles%rowtype;
  new_pair_id uuid;
  pair_size integer;
begin
  select *
  into current_profile
  from public.profiles
  where id = auth.uid()
  for update;

  if current_profile.id is null then
    raise exception 'Current profile not found';
  end if;

  if current_profile.active_pair_id is not null then
    raise exception 'You already belong to an active pair';
  end if;

  select *
  into partner_profile
  from public.profiles
  where invite_code = upper(trim(invite_code_input))
  for update;

  if partner_profile.id is null then
    raise exception 'Invite code is invalid';
  end if;

  if partner_profile.id = current_profile.id then
    raise exception 'You cannot join yourself';
  end if;

  if partner_profile.active_pair_id is not null then
    raise exception 'That user already belongs to an active pair';
  end if;

  insert into public.pairs (created_by)
  values (current_profile.id)
  returning id into new_pair_id;

  insert into public.pair_members (pair_id, profile_id, slot)
  values
    (new_pair_id, current_profile.id, 'left'),
    (new_pair_id, partner_profile.id, 'right');

  select count(*)
  into pair_size
  from public.pair_members
  where pair_id = new_pair_id;

  if pair_size <> 2 then
    raise exception 'Pair must contain exactly 2 members';
  end if;

  update public.profiles
  set active_pair_id = new_pair_id
  where id in (current_profile.id, partner_profile.id);

  return new_pair_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.pairs enable row level security;
alter table public.pair_members enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "pairs_read_member" on public.pairs;
create policy "pairs_read_member"
on public.pairs
for select
to authenticated
using (public.is_member_of_pair(id));

drop policy if exists "pair_members_read_pair" on public.pair_members;
create policy "pair_members_read_pair"
on public.pair_members
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_member_of_pair(pair_id)
);

drop policy if exists "tasks_read_pair" on public.tasks;
create policy "tasks_read_pair"
on public.tasks
for select
to authenticated
using (public.is_member_of_pair(pair_id));

drop policy if exists "tasks_insert_pair" on public.tasks;
create policy "tasks_insert_pair"
on public.tasks
for insert
to authenticated
with check (
  public.is_member_of_pair(pair_id)
  and created_by = auth.uid()
  and exists (
    select 1
    from public.pair_members pm
    where pm.pair_id = tasks.pair_id
      and pm.profile_id = tasks.owner_profile_id
  )
);

drop policy if exists "tasks_update_pair" on public.tasks;
create policy "tasks_update_pair"
on public.tasks
for update
to authenticated
using (public.is_member_of_pair(pair_id))
with check (
  public.is_member_of_pair(pair_id)
  and exists (
    select 1
    from public.pair_members pm
    where pm.pair_id = tasks.pair_id
      and pm.profile_id = tasks.owner_profile_id
  )
);

grant execute on function public.create_pair_with_invite(text) to authenticated;
