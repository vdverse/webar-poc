-- viewer_events: anonymous, coarse-grained analytics for the public
-- viewer/AR pages. Deliberately has no owner_id column — ownership for the
-- read-side is derived by joining through ar_projects, and the insert-side
-- validates against the live publications table instead of trusting any
-- client-supplied identifier, so there is nothing here for a browser to
-- spoof its way into another creator's analytics.

create table public.viewer_events (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.publications(id) on delete cascade,
  project_id uuid references public.ar_projects(id) on delete cascade,
  event_type text not null,
  anonymous_session_id text,
  device_type text,
  browser_family text,
  ar_mode text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint viewer_events_event_type_check check (event_type in (
    'qr_page_opened', 'model_preview_loaded', 'model_preview_failed',
    'ar_button_clicked', 'ar_launch_started', 'webxr_started',
    'scene_viewer_launched', 'quick_look_launched', 'ar_launch_failed',
    'share_clicked', 'qr_downloaded'
  ))
);

create index viewer_events_project_id_idx on public.viewer_events (project_id);
create index viewer_events_publication_id_idx on public.viewer_events (publication_id);
create index viewer_events_event_type_idx on public.viewer_events (event_type);
create index viewer_events_created_at_idx on public.viewer_events (created_at);

alter table public.viewer_events enable row level security;

-- Creators can read analytics only for events tied to one of their own
-- projects.
create policy "viewer_events_owner_select"
  on public.viewer_events for select
  using (
    exists (
      select 1 from public.ar_projects p
      where p.id = viewer_events.project_id and p.owner_id = auth.uid()
    )
  );

-- Anonymous and authenticated viewers may insert an event only when it
-- names a known event type and points at a publication that is currently
-- active and genuinely belongs to the stated project — the "tightly
-- validated" public analytics insert required by the plan.
create policy "viewer_events_public_insert"
  on public.viewer_events for insert
  with check (
    publication_id is not null
    and exists (
      select 1 from public.publications pub
      where pub.id = publication_id
        and pub.is_active = true
        and pub.project_id = viewer_events.project_id
    )
  );
