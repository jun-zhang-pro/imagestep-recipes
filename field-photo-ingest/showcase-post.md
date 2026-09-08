# r/n8n showcase draft — "Phone photos from site visits, filed by month and GPS, with links that don't rot"

**What I built**

Our surveyors shoot HEIC on iPhones into a shared Drive folder. Nobody renames anything, so
finding "the north site in July" meant scrolling thumbnails. This files every photo by when and
where it was taken and gives each a permanent URL the report can link to.

**The workflow** (8 nodes, one small Code node)

1. **Google Drive Trigger** on the folder → **Google Drive** download.
2. **ImageStep → Asset → Upload** with *Wait Until Ready* — HEIC is decoded server-side and EXIF /
   GPS are read by the time the node returns.
3. **ImageStep → Asset → Get** — the asset carries `metadata.dateTimeOriginal`, `gpsLatitude`,
   `gpsLongitude`; no separate metadata job.
4. **Code** — `YYYY-MM/<lat,lon>` at three decimals (about 100 m). No reverse geocoding on purpose:
   coordinates are exact, place names are opinions, and the GIS people prefer numbers.
5. **HTTP Request** — one `POST /api/v1/assets/update` to set that label and publish.
6. **ImageStep → Asset → Get** for the public URL → **Google Sheets** append the manifest row.

**The result**

About 300 photos from the first fortnight, filed with zero manual work. The sheet is the manifest,
and `label` doubles as a filter in the asset list, so "everything from 48.858,2.294 in 2026-09" is
one query. Photos without GPS land under `no-gps` and stand out at once. Reading EXIF, labelling
and publishing are free operations, so it cost nothing beyond the storage plan.

Template plus the SDK script for a local folder:
[imagestep-recipes/field-photo-ingest](https://github.com/jun-zhang-pro/imagestep-recipes/tree/main/field-photo-ingest)
