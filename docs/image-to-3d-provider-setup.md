# Image-to-3D provider setup

Supabase project: `codqgrxradxaloruoyys`

## Secrets (server only — never `VITE_*`)

```bash
supabase secrets set \
  IMAGE_TO_3D_PROVIDER=meshy \
  IMAGE_TO_3D_API_KEY=YOUR_MESHY_KEY \
  IMAGE_TO_3D_WEBHOOK_SECRET=optional-random \
  --project-ref codqgrxradxaloruoyys
```

`SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` / `SUPABASE_ANON_KEY` are
injected automatically for Edge Functions.

### Development mock (local / non-prod only)

```bash
supabase secrets set \
  IMAGE_TO_3D_PROVIDER=mock \
  IMAGE_TO_3D_ALLOW_MOCK=true \
  --project-ref codqgrxradxaloruoyys
```

Do **not** leave `IMAGE_TO_3D_ALLOW_MOCK=true` on production with real traffic
expecting AI quality — the mock re-hosts a Khronos sample GLB.

## Deploy functions

```bash
supabase functions deploy create-generation-job \
  get-generation-status cancel-generation-job process-generation-result \
  --project-ref codqgrxradxaloruoyys
```

## Apply migration

```bash
supabase db push --project-ref codqgrxradxaloruoyys
# or apply 0015_generation_job_hardening.sql via SQL editor
```

## Credits

Free profiles start with `profiles.generation_credits = 1` (migration 0002).
Each successful job submit decrements credits server-side. Top up for testing:

```sql
update public.profiles set generation_credits = 10 where id = '<your-user-uuid>';
```

## Batch 3B checklist (you)

1. Create Meshy account with API access (Pro+ per Meshy docs).
2. Create API key → set `IMAGE_TO_3D_API_KEY`.
3. Set `IMAGE_TO_3D_PROVIDER=meshy`.
4. Deploy functions + migration 0015.
5. Upload a photo project → Generate → wait → Open GLB Studio → Publish → AR.
