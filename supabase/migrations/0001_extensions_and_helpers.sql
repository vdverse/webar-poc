-- Extensions and shared helpers used by every subsequent migration.

create extension if not exists "pgcrypto";

-- Generic trigger: keeps `updated_at` current on any row update. Attached
-- per-table in the migrations that follow.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
