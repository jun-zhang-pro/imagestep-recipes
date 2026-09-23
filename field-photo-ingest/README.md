# Field photo ingest — HEIC in, dated · geotagged · stable URLs out

Phone photos from the field (HEIC, straight off an iPhone) → **EXIF date and GPS read** → each photo filed in the
collection `YYYY-MM/<lat,lon>` → published → a **manifest CSV** with a stable URL per photo. No reverse geocoding:
the collection name carries coordinates (3 decimals ≈ 100 m), which is what a GIS tool, a map link or a later
geocoding pass wants anyway.

Reading metadata costs nothing and needs no job: once an upload has finished ingesting, the asset already carries its
EXIF under exiftool's names — `DateTimeOriginal` as an ISO date, `GPSLatitude` / `GPSLongitude` as signed decimals —
so reading it is one `GET`. HEIC is decoded server-side; the published file is a browser-friendly rendition.

## What you need

- An ImageStep API key (`IMAGESTEP_API_KEY`).
- **Script**: Node 18+ and a folder of photos (`.heic` / `.jpg` / `.png`; anything without EXIF still ingests, it just
  lands under `unknown-date/no-gps`). `examples/field/` is one, with one photo whose EXIF says August 2026 in
  Yosemite Valley.
- **n8n**: Google Drive + Google Sheets credentials, the `n8n-nodes-imagestep` node, and one generic *Header Auth*
  credential (`Authorization: ApiKey is_sk_…`) for the single HTTP Request node that files and publishes. A Drive
  folder the phone syncs into, and a sheet as the manifest.

## Run the script

```sh
pnpm install
export IMAGESTEP_API_KEY=is_sk_…
node field-photo-ingest/ingest.mjs examples/field          # writes examples/field/manifest.csv
node field-photo-ingest/ingest.mjs ./photos --out site-a.csv --concurrency 4
```

Per photo: upload (waits for ingest) → `ops.readMetadata` → `DateTimeOriginal` → `YYYY-MM`, `GPSLatitude` /
`GPSLongitude` → `lat,lon` → `assets.setCollection(id, "2026-08/37.746,-119.594")` → `assets.publish`. Uploads run
four at a time (sha1 dedupe: re-running reuses what is already there). The manifest has `file, assetId, takenAt,
latitude, longitude, collection, width, height, publicUrl`. Later, `client.assets.list({ collection:
"2026-08/37.746,-119.594" })` returns the photos of one place and month, and `client.assets.collections()` lists every
place you have filed.

## Run the n8n template

Import `n8n-template.json`, then set the Drive folder on **New Field Photo**, the Header Auth credential on
**Collection & Publish**, the sheet on **Append Manifest Row**, and the ImageStep credential on the three ImageStep
nodes. Sync a photo into the folder: within a minute it is in the sheet with its date, coordinates, collection and
URL.

## What it costs

Nothing per photo beyond your plan's asset quota: upload, metadata, filing and publishing are all free. Retention
follows the plan the asset was created under.
