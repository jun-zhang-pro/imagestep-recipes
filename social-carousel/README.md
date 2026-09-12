# Social carousel — one character, every card

Google Sheet rows (`headline`, `subline`) → **4 on-brand images per row** with the same character
(or product) on all of them → published → the URLs written back into the sheet.

The trick is one ImageStep **AI preset with a subject**: `{name, referenceAssetIds, descriptor}`.
Drift has two halves and a subject closes both. The 1–3 reference images pin the geometry — every
`generate` call made with the preset sends them to the model. The `descriptor` pins the words:
colour under other lighting, material, the text on a label, none of which a photo states on its
own. Your prompt writes `{{subject.hero}}` instead of re-describing them, and the server expands it
to the stored wording, so the run three weeks from now says exactly what today's run said. Change
either half and the preset gets a new version, so every row records which version drew it.

## What you need

- An ImageStep API key (`IMAGESTEP_API_KEY`, from the console).
- 1–3 clean reference images of the character / product (front-facing, plain background works
  best). Up to 4 are accepted.
- One sentence of locked wording for them (`--describe`) — what the photos cannot say themselves.
- **Script**: Node 18+, the rows as a CSV (`headline,subline` — export your Sheet, or start from
  `rows.example.csv`).
- **n8n**: the Google Sheets credential and the `n8n-nodes-imagestep` community node; a Sheet with
  columns `headline`, `subline`, `url1`…`url4`, `status`.

## Run the script

```sh
pnpm install                  # in the repo root; pulls `imagestep` from npm
export IMAGESTEP_API_KEY=is_sk_…
node social-carousel/carousel.mjs --refs hero-front.jpg,hero-side.jpg \
  --describe "a woman in her thirties with short silver hair, navy jacket" \
  --rows social-carousel/rows.example.csv --dry-run
node social-carousel/carousel.mjs --refs hero-front.jpg,hero-side.jpg \
  --describe "a woman in her thirties with short silver hair, navy jacket" \
  --rows social-carousel/rows.example.csv
```

What it does, in order:

1. uploads the reference images (sha1 dedupe — re-runs re-use them),
2. creates the preset `carousel-brand` with one subject (or updates it when the images or the
   wording changed → new version),
3. prices one row with `dryRun` and prints it — the estimate also echoes the prompt with
   `{{subject.hero}}` already expanded, so a mis-typed handle costs a round trip and not a batch of
   almost-right pictures. Stops there with `--dry-run`.
4. per row: `generate` × 4 through the preset — the row's prompt overrides the preset's default
   prompt and names the subject rather than re-describing it — waits, publishes, collects
   `publicUrl`s (two rows at a time),
5. writes `rows.example.out.csv` with `presetVersion`, `jobId`, `url1`…`url4`.

Options: `--preset <slug>`, `--per-row <n>`, `--out <file>`, `--subject <name>` (default `hero`),
`--describe <words>`, `--model <id>` (any model that takes text + several images: the Gemini image
models, GPT-Image; a single-image model is refused as `invalid_param` on `subjects` before anything
is charged).

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
const preset = await client.aiPresets.get("carousel-brand");          // subjects: [...], version: N
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
