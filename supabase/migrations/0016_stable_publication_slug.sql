-- Allow multiple publication versions to share one stable public_slug.
-- Previously UNIQUE(public_slug) blocked republish after deactivate:
-- insert of version N with the same slug failed while inactive version 1
-- still held the slug. Preferred product behaviour: stable slug, new version
-- row, one active row (publications_one_active_per_project already exists).

alter table public.publications
  drop constraint if exists publications_public_slug_key;

-- At most one *active* publication may claim a given slug (viewers resolve
-- by slug + is_active). Historical inactive versions may share the same slug.
create unique index if not exists publications_one_active_per_slug
  on public.publications (public_slug)
  where is_active;

comment on index public.publications_one_active_per_slug is
  'Stable public URLs: many versions share a slug; only one active row per slug.';
