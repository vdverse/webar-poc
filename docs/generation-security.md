# Generation security

## Must never happen

- Provider API key in frontend / `VITE_*`
- Service-role key in frontend
- Public source-image buckets
- Permanent signed URLs stored in the database
- Browser writing `generation_jobs.status = completed`
- Trusting `owner_id` from the client body
- Downloading arbitrary result URLs (SSRF)

## Controls in Batch 3A

| Control | Implementation |
|---------|----------------|
| JWT auth | Edge Functions + `auth.getUser()` |
| Ownership | Compare `ar_projects.owner_id` to JWT uid |
| Source method gate | `single_image` / `multi_view` only |
| Signed source URLs | 15-minute TTL, created server-side |
| Active job lock | Partial unique index + 409 response |
| Credits | `profiles.generation_credits` decremented server-side |
| Result host allow-list | Meshy / Tripo / GitHub raw (mock) only, HTTPS |
| GLB magic | `glTF` header before store |
| Max size | 25 MB |
| Safe errors | Mapped codes; no raw provider dumps to UI |
| Mock gate | `IMAGE_TO_3D_ALLOW_MOCK=true` required |

## RLS

`generation_jobs`: authenticated **SELECT** only (0005).  
Writes via service role in Edge Functions.

Direct GLB upload owner insert policies (0013) remain for manual Studio path.
