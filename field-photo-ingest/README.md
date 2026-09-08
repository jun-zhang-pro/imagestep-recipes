# Field photo ingest — HEIC in, dated · geotagged · stable URLs out

Phone photos from the field (HEIC, straight off an iPhone) → **EXIF date and GPS read** →
each photo labelled `YYYY-MM/<lat,lon>` → published → a **manifest CSV** with a stable URL per
photo. No reverse geocoding: the label carries coordinates (3 decimals ≈ 100 m), which is what a
GIS tool, a map link or a later geocoding pass wants anyway.

`read_metadata` is a sync op: the asset already carries EXIF / GPS / dimensions once ingest
finishes, so reading it is one `GET` and costs nothing. HEIC is decoded server-side; the published
preview is a browser-friendly rendition.

## What you need

- An ImageStep API key (`IMAGESTEP_API_KEY`).
- **Script**: Node 18+ and a folder of photos (`.heic` / `.jpg` / `.png`; anything without EXIF
  still ingests, it just lands under `unknown-date/no-gps`).
- **n8n**: Google Drive + Google Sheets credentials, the `n8n-nodes-imagestep` node, and one
  generic *Header Auth* credential (`Authorization: ApiKey isk_…`) for the single HTTP Request
  node that sets the label. A Drive folder the phone syncs into, and a Sheet as the manifest.

## Run the script

```sh
pnpm install
export IMAGESTEP_API_KEY=isk_…
node field-photo-ingest/ingest.mjs ./photos               # writes ./photos/manifest.csv
node field-photo-ingest/ingest.mjs ./photos --out site-a.csv --concurrency 4
```

Per photo: upload (waits for ingest) → `ops.readMetadata` → `dateTimeOriginal` → `YYYY-MM`,
`gpsLatitude` / `gpsLongitude` → `lat,lon` → `assets.label(id, "2026-09/48.858,2.294")` →
`assets.publish`. Uploads run four at a time (sha1 dedupe: re-running skips nothing but costs
nothing either). The manifest has `file, assetId, takenAt, latitude, longitude, label, width,
height, publicUrl`. Later, `client.assets.list({ folder: "2026-09/48.858,2.294" })` returns the
photos of one place and month.

## Run the n8n template

Import `n8n-template.json`, then set the Drive folder on **New Field Photo**, the Header Auth
credential on **Label by Date & Place**, the Sheet on **Append Manifest Row**, and the ImageStep
credential on the three ImageStep nodes. Sync a photo into the folder: within a minute it is in the
sheet with its date, coordinates, label and URL.

## What it costs

Nothing per photo beyond your plan's asset quota: upload, metadata, labelling and publishing are
all free operations. Retention follows the plan the asset was created under.
