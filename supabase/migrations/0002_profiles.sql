-- profiles: one row per auth user, auto-created on sign-up.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  plan text not null default 'free',
  generation_credits integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_plan_check check (plan in ('free', 'creator')),
  constraint profiles_credits_nonnegative check (generation_credits >= 0)
);

alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- A profile row is created automatically when a new auth user signs up, so
-- application code never has to remember to seed the free-plan defaults and
-- can't forget to create one. security definer is required because this
-- runs as a trigger on auth.users, which the client role cannot write to.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: a user may read and update only their own profile row. There is no
-- insert or delete policy for the authenticated role — rows are created
-- only by the security-definer trigger above and never deleted directly
-- (they cascade-delete when the auth user is removed).
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
