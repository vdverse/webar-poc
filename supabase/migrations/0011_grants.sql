-- Explicit grants. RLS policies restrict which *rows* a role can see or
-- change; grants restrict which *commands* it may attempt in the first
-- place. A fresh Postgres schema gives anon/authenticated no table
-- privileges by default, so every table the browser talks to directly
-- (as opposed to only through a service-role Edge Function) needs an
-- explicit grant here — otherwise its RLS policies are unreachable dead
-- code. generation_jobs and generated_models are intentionally omitted
-- from write grants: they are written only by the service role.

grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;

grant select, insert, update, delete on public.ar_projects to authenticated;

grant select, insert, update, delete on public.project_source_images to authenticated;

grant select on public.generation_jobs to authenticated;

grant select on public.generated_models to authenticated;

grant select, insert, update on public.scene_settings to authenticated;

grant select on public.publications to authenticated, anon;

grant select on public.viewer_events to authenticated;
grant insert on public.viewer_events to authenticated, anon;
