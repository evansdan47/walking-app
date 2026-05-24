# Additional Questions — Photo Architecture

---

## Q: Are photos taken through the app saved to the user's camera roll, uploaded immediately, or only queued by OS asset reference?

**A:** Photos should be **saved to the camera roll first**, then the app stores the
OS asset URI (e.g. `ph://` on iOS, `content://media/...` on Android) in the local
`walk_photos` row. This means:

- The user always has their photo in their gallery regardless of what happens to the app.
- The app never needs to manage its own blob storage on device.
- The upload path reads from the OS asset URI when it's time to push to Convex file
  storage — it doesn't need its own copy.

Do **not** upload immediately at capture time. Queue the upload as part of the sync
job so it follows the same lifecycle as the walk data. Immediate upload during
recording wastes battery and fails silently on poor connectivity.

---

## Q: What happens if the user records offline and takes photos?

**A:** Completely fine — this is the expected case. The photo is saved to the camera
roll at capture time and the `walk_photos` row is written to SQLite with:

- `local_uri` (OS asset reference — always valid while the asset exists in the library)
- `timestamp`, `latitude`, `longitude`, `caption`
- `convex_id = NULL`, `storage_id = NULL` (not yet synced)

When connectivity returns and the walk sync runs, photo upload is phase 3 of the sync
job. The app resolves the `local_uri` to a byte stream and uploads then.

One risk: the user deletes the photo from their camera roll before the walk syncs.
Handle this by catching the "asset not found" error during upload, marking that photo
as `upload_skipped` in `walk_photos`, and continuing the sync. Do not fail the whole
job because one photo was deleted.

---

## Q: Can a walk be synced without photos, with photos added later?

**A:** Yes. Walk sync (phases 1–2: walk record + track points) and photo upload
(phase 3) are independently completable. A walk can be fully synced with zero photos
uploaded. If the user adds a photo to a walk later (a future post-walk annotation
feature), that becomes a standalone upload job rather than part of the original sync
job.

For MVP, photos are captured during recording only and synced as part of the same job.
Post-walk photo addition is a future feature — do not design for it now, but do not
design against it either (i.e. do not use a composite primary key that assumes one
sync job per walk forever).

---

## Q: Should photo upload failure block walk sync?

**A:** No. Walk sync (the walk record + track points) is core data and must complete
regardless of photo upload status. Photo upload failure sets the photo row to
`upload_failed` and schedules a retry, but the `syncJobs` row for the walk is marked
`synced` once phases 1 and 2 complete.

The status shown in the UI should be:

- `synced` — walk record and track points confirmed on Convex
- `synced (photos pending)` — walk synced, some photos still queued or failed

Never show the walk as `failed` because photos didn't upload.

---

## Q: Should review show missing photo placeholders?

**A:** Yes, but distinguish between two different states:

| State | What to show |
|---|---|
| Photo in SQLite, `local_uri` valid, not yet synced | Show full-resolution thumbnail from local asset — user sees it immediately |
| Photo in SQLite, `local_uri` broken, `storage_id` present | Show a network thumbnail fetched from Convex (if online) |
| Photo in SQLite, `local_uri` broken, `storage_id = NULL` (upload skipped) | Show a grey placeholder with a "photo unavailable" icon |
| Photo in Convex but not in local SQLite (downloaded walk from another device — future) | Show a network thumbnail if online, grey placeholder if offline |

The review timeline should never crash or skip a photo entry because the asset is
unavailable. The placeholder keeps the timeline layout stable.

---

## Q: Are photo coordinates/timestamps stored even if upload fails?

**A:** Yes. The `walk_photos` row is written to SQLite at the moment the photo is
captured — before any upload is attempted. Coordinates, timestamp, and caption are
local data. Upload failure only affects `convex_id` and `storage_id`, which remain
`NULL` until a successful upload.

This means a photo with a broken `local_uri` and failed upload still has its
spatial and temporal metadata, so the review timeline can position it correctly even
if the actual image cannot be displayed.

---

## Q: Do we need a `photo_upload_jobs` table separate from `sync_jobs`?

**A:** For MVP: **no**. Keep photo upload as phase 3 of the walk's `syncJobs` row.
A separate table is premature unless one of these conditions is true:

1. Post-walk photo addition is supported (a photo not tied to the original sync job)
2. Bulk re-upload of failed photos across multiple walks needs to be scheduled
3. Photo upload needs its own retry cadence independent of the walk

None of these apply to MVP. Introduce `photo_upload_jobs` only if condition 1 is
built, since that is the first case where a photo exists outside its walk's sync job
lifecycle.

---

## Summary / Your Recommendation

**Agreed entirely.** Walk/route data and photos have different criticality and
different failure tolerances:

- **Walks and track points:** Core. Sync blocking. User must know if sync fails.
- **Photos:** Enrichment. Non-blocking. Silent retry is acceptable. Never prevent
  a walk from being viewed, followed, or shared because photo upload is incomplete.

The architecture should reflect this: one `syncJobs` row per walk, with photo upload
as a later phase that can fail independently. The walk is "done" when the core data
lands on Convex.
