# ImageStep recipes

Three small, complete workflows built on [ImageStep](https://imagestep.dev) — the image step for
your automations. Each recipe is a folder with the same four things:

| | |
|---|---|
| `README.md` | what it does, what you need, how to run it, what it costs |
| `*.mjs` | the workflow as a Node script on the `imagestep` SDK (`pnpm add imagestep`) |
| `n8n-template.json` | the same workflow as an n8n export — **Workflows → Import from file** |
| `showcase-post.md` | a short write-up in r/n8n showcase form |

| Recipe | In | Out |
|---|---|---|
| [`social-carousel/`](social-carousel/) | Google Sheet rows (`headline`, `subline`) + 1–3 reference images of your character / product | 4 on-brand images per row, published, URLs written back into the sheet — the same character on every card |
| [`product-trio/`](product-trio/) | one product photo | a cut-out (`remove_bg`), a white-padded packshot and a 1200 px web size, in parallel, each with a stable URL |
| [`field-photo-ingest/`](field-photo-ingest/) | phone HEIC uploads | EXIF date + GPS read, each photo labelled `YYYY-MM/<lat,lon>`, published, and a manifest CSV of stable URLs |

## Run any of them

```sh
pnpm install
export IMAGESTEP_API_KEY=isk_…          # https://imagestep.dev → API keys
pnpm carousel --refs hero-1.jpg,hero-2.jpg --rows social-carousel/rows.example.csv
pnpm trio ./product.jpg
pnpm ingest ./photos
```

Every script prices itself first (`dryRun`) and prints the estimate before spending credits.
Deterministic ops (`pad`, `resize`, `convert`, `read_metadata`) cost no credits; AI ops
(`generate`, `edit`, `remove_bg`, `upscale`) charge per image — the exact number is always the dry
run, never this README.

## The n8n templates

They are written against the official Google nodes (`googleSheetsTrigger` v1, `googleSheets`
v4.5, `googleDriveTrigger` v1, `googleDrive` v3, `merge` v3) and the
[`n8n-nodes-imagestep`](https://www.npmjs.com/package/n8n-nodes-imagestep) community node at
version 1. Every credential is a `REPLACE_ME` and every folder / spreadsheet id a `REPLACE_WITH_…`:
open each node once, pick yours from the list, save. They are documentation-grade exports —
authored against the node descriptions, not executed in a live n8n — so run the first execution
on one row / one file before pointing them at a thousand.

## License

MIT — copy, change, ship.
