-- scene_settings: one row per project, editable by the creator in the
-- Batch 5 editor. One-to-one with ar_projects via primary key = project_id.

create table public.scene_settings (
  project_id uuid primary key references public.ar_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  model_id uuid references public.generated_models(id) on delete set null,
  scale numeric not null default 1,
  rotation_x numeric not null default 0,
  rotation_y numeric not null default 0,
  rotation_z numeric not null default 0,
  placement_mode text not null default 'floor',
  shadow_intensity numeric not null default 1,
  auto_rotate boolean not null default true,
  camera_controls boolean not null default true,
  animation_name text,
  animation_autoplay boolean not null default true,
  animation_loop boolean not null default true,
  viewer_config jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  constraint scene_settings_placement_mode_check check (placement_mode in ('floor', 'wall', 'table')),
  constraint scene_settings_scale_positive check (scale > 0)
);

alter table public.scene_settings enable row level security;

create trigger scene_settings_set_updated_at
  before update on public.scene_settings
  for each row execute function public.set_updated_at();

create policy "scene_settings_owner_select"
  on public.scene_settings for select
  using (auth.uid() = owner_id);

create policy "scene_settings_owner_insert"
  on public.scene_settings for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.ar_projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "scene_settings_owner_update"
  on public.scene_settings for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
