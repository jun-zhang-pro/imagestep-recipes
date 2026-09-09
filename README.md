# ImageStep recipes

Three complete, copy-and-ship workflows built on [ImageStep](https://imagestep.dev) — the image
step for your automations: generate, edit, remove background, upscale, convert and read metadata,
over a REST API with a [JS SDK](https://www.npmjs.com/package/imagestep) and an
[n8n node](https://www.npmjs.com/package/n8n-nodes-imagestep).

Each recipe runs two ways — as a Node script short enough to read in one sitting, or as an n8n
workflow you import from a file. MIT: copy it, change it, ship it.

## The recipes

| Recipe | In | Out |
|---|---|---|
| **[social-carousel](social-carousel/)** | sheet rows (`headline`, `subline`) + 1–3 reference images | 4 on-brand cards per row — the same character on every one — published, URLs written back into the sheet |
| **[product-trio](product-trio/)** | one product photo | a transparent cut-out, a white packshot and a 1200 px web size, in parallel, each with a stable URL |
| **[field-photo-ingest](field-photo-ingest/)** | a folder of phone HEICs | EXIF date + GPS read, each photo labelled `YYYY-MM/<lat,lon>`, published, plus a manifest CSV |

## Quick start

You need Node 18+ and an ImageStep API key ([console](https://imagestep.dev) → API keys).

```sh
pnpm install
export IMAGESTEP_API_KEY=mm_sk_…
```

The two recipes that spend credits take `--dry-run`: it prices the job, prints the estimate and
stops. Run that first.

```sh
pnpm trio ./product.jpg --dry-run
pnpm trio ./product.jpg

pnpm carousel --refs hero-front.jpg,hero-side.jpg --rows social-carousel/rows.example.csv --dry-run
pnpm carousel --refs hero-front.jpg,hero-side.jpg --rows social-carousel/rows.example.csv

pnpm ingest ./photos          # free: no AI op, nothing to price
```

Flags, defaults and the acceptance step for each workflow are in that recipe's own README.

## What's in a recipe folder

| File | |
|---|---|
| `README.md` | what it does, what you need, how to run it, what it costs |
| `*.mjs` | the workflow as a Node script on the `imagestep` SDK |
| `n8n-template.json` | the same workflow as an n8n export — **Workflows → Import from file** |
| `showcase-post.md` | a short write-up in r/n8n showcase form |

## What it costs

Deterministic ops (`pad`, `resize`, `convert`, `read_metadata`) cost no credits; uploading,
labelling and publishing are free too. AI ops (`generate`, `edit`, `remove_bg`, `upscale`) charge
per image — so a carousel row is 4 charges and a product trio is 1. The figure that matters is the
one your dry run prints, never this README.

## About the n8n templates

They are written against the official Google nodes (`googleSheetsTrigger` v1, `googleSheets` v4.5,
`googleDriveTrigger` v1, `googleDrive` v3, `merge` v3) and `n8n-nodes-imagestep` v1. Every
credential is a `REPLACE_ME` and every folder / spreadsheet id a `REPLACE_WITH_…`: open each node
once, pick yours from the list, save.

One caveat, stated plainly: these are documentation-grade exports — authored against the node
descriptions, not executed in a live n8n. Run the first execution on one row or one file before
pointing them at a thousand.

## License

MIT — see [LICENSE](LICENSE).
