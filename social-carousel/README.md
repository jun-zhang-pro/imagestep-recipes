# Social carousel — one character, every card

Google Sheet rows (`headline`, `subline`) → **4 on-brand images per row** with the same character
(or product) on all of them → published → the URLs written back into the sheet.

The trick is one ImageStep **AI preset with `references`**: you attach 1–3 reference images of
your character once, and every `generate` call made with that preset sends them to the model as
identity references, with your row's text as the scene. Change the references and the preset gets
a new version, so every row records which version drew it.

## What you need

- An ImageStep API key (`IMAGESTEP_API_KEY`, from the console).
- 1–3 clean reference images of the character / product (front-facing, plain background works
  best). Up to 4 are accepted.
- **Script**: Node 18+, the rows as a CSV (`headline,subline` — export your Sheet, or start from
  `rows.example.csv`).
- **n8n**: the Google Sheets credential and the `n8n-nodes-imagestep` community node; a Sheet with
  columns `headline`, `subline`, `url1`…`url4`, `status`.

## Run the script

```sh
pnpm install                  # in the repo root; pulls `imagestep` from npm
export IMAGESTEP_API_KEY=isk_…
node social-carousel/carousel.mjs --refs hero-front.jpg,hero-side.jpg --rows social-carousel/rows.example.csv --dry-run
node social-carousel/carousel.mjs --refs hero-front.jpg,hero-side.jpg --rows social-carousel/rows.example.csv
```

What it does, in order:

1. uploads the reference images (sha1 dedupe — re-runs re-use them),
2. creates the preset `carousel-brand` (or updates it when the references changed → new version),
3. prices one row with `dryRun` and prints it, stops there with `--dry-run`,
4. per row: `generate` × 4 through the preset — the row's prompt overrides the preset's default
   prompt, the references stay fixed — waits, publishes, collects `publicUrl`s (two rows at a time),
5. writes `rows.example.out.csv` with `presetVersion`, `jobId`, `url1`…`url4`.

Options: `--preset <slug>`, `--per-row <n>`, `--out <file>`, `--model <id>` (any model that takes
text + several images: the Gemini image models, GPT-Image; a single-image model is refused as
`invalid_param` on `references` before anything is charged).

## Run the n8n template

Import `n8n-template.json` (Workflows → Import from file), then:

1. **Google Sheets Trigger** / **Write URLs Back** — pick your spreadsheet and sheet.
2. **Generate 4 Cards** — set the ImageStep credential and put your preset id in
   *Options → AI Preset* (create the preset once with the script above, or in the console; the id
   is in `GET /api/v1/ai-presets/carousel-brand`).
3. Add a row with `headline` and `subline`; within a minute the row has `url1`…`url4` and `status`.

## Check consistency (the acceptance step)

Run the same preset four times with the same prompt and look at the four results side by side.
With the SDK, against production:

```js
import { ImageStep } from "imagestep";
const client = new ImageStep({ apiKey: process.env.IMAGESTEP_API_KEY });
const preset = await client.aiPresets.get("carousel-brand");          // references: [...], version: N
const job = await client.ops.generate("the character waving at the camera, city street, morning", {
  presetId: preset.id, count: 4, wait: true
});
const outputs = await client.jobs.outputs(job);
console.log((await client.assets.publish(outputs.map((a) => a.id))).map((a) => a.publicUrl));
```

Score each of the four against the reference on face / hair / outfit / proportions (1–5), note the
preset version, keep the sheet. A second batch with a **different** prompt and the same preset is
the real test — same identity, different scene.

## What it costs

`generate` is an AI op: one credit charge per image, so 4 per row; the exact figure is the dry run
(`estimatedCredits`) printed before anything runs. Uploads, publishing and the preset itself are
free. The n8n node has a *Dry Run* switch for the same number.
