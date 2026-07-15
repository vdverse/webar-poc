# Generation job lifecycle

```
queued → submitted → processing → completed
                              ↘ failed
                              ↘ cancelled
```

Legacy/compat statuses from 0005: `uploading`, `expired`.

## Honest UI stages

Preparing images → Submitting generation → Waiting in queue →
Building geometry → Applying textures → Optimising model →
Downloading result → Validating GLB → Preparing studio → Complete

Numeric `%` is shown **only** when the provider returns a progress value
between 1 and 99. The UI never invents percentages.

## Actors

| Step | Who |
|------|-----|
| Create job | Authenticated creator → `create-generation-job` |
| Poll status | Frontend → `get-generation-status` → provider |
| Download GLB | Edge Function (service role) → private bucket |
| Write job/model rows | Service role only |
| Read job | Owner SELECT RLS |

## Refresh

Job rows live in `generation_jobs`. Refresh reloads the latest row from
Postgres, then resumes polling if status is still active.

## Idempotency

- Unique partial index: one active job per `project_id`
- `request_hash` of project + image ids + mode
- Completed ingestion checks existing `generated_models.generation_job_id`
