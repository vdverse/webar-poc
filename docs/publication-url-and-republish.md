# Publication URL and republish notes

## Canonical QR origin

QR codes and studio share links are built as:

`{VITE_PUBLIC_APP_URL}/view/{public_slug}`

| Environment | `VITE_PUBLIC_APP_URL` |
|-------------|------------------------|
| Vercel production/preview | `https://webar-poc-one.vercel.app` |
| LAN mobile testing | `https://192.168.1.207:5173` (your Network URL) |
| Desktop-only local | `http://localhost:5173` |

Restart the Vite dev server after changing `.env.local`.

Snapshots store `public_slug` + asset paths + scene JSON. They do **not** store
an absolute localhost viewer URL. The origin is resolved at display time.

## Republish behaviour (preferred)

1. Keep a **stable** `public_slug` per project.
2. `version = max(version) + 1`.
3. Deactivate prior active row.
4. Insert a new immutable snapshot.
5. Assets at `{projectId}/{version}/model.glb`.
6. Same `/view/{slug}` resolves to the active version.

Migration `0016_stable_publication_slug.sql` removes the global `UNIQUE(public_slug)`
constraint that blocked republish (inactive v1 still held the slug). Replaced with
a partial unique index on `public_slug` where `is_active`.

## Failure cleanup

If public GLB upload succeeds but publication insert fails:

- remove only the newly uploaded orphan asset
- reactivate the previous active publication when one existed
- do not mark the project published from a failed insert
