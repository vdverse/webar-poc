-- Batch 2: wizard persistence. The creation wizard's resumable state lives
-- in the database (source of truth), not in local storage: which source
-- method was chosen and which step the creator last completed. Both are
-- nullable — projects created before this migration, or outside the
-- wizard, simply have no wizard state.

alter table public.ar_projects
  add column source_method text,
  add column wizard_stage text;

alter table public.ar_projects
  add constraint ar_projects_source_method_check
    check (source_method is null or source_method in ('single_image', 'multi_view', 'glb_upload')),
  add constraint ar_projects_wizard_stage_check
    check (wizard_stage is null or wizard_stage in ('details', 'source_method', 'capture', 'review', 'saved'));
