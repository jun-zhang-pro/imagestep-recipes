// Social carousel: Google Sheet rows (headline, subline) → 4 on-brand images per row with a
// reference-bound ImageStep preset → publish → URLs back in the sheet (as a CSV next to the input).
//
//   IMAGESTEP_API_KEY=is_sk_… node carousel.mjs --refs hero-1.jpg,hero-2.jpg \
//     --describe "a woman in her thirties with short silver hair, navy jacket" --rows rows.csv
//
// Options: --preset <slug> (default carousel-brand) · --per-row <n> (default 4) · --out <file>
// (default <rows>.out.csv) · --model <id> (default google/gemini-3.1-flash-image-preview) ·
// --subject <name> (default hero) · --describe <words> (the locked descriptor) ·
// --dry-run (price only, spend nothing).
//
// The Sheet itself is the n8n template's job (n8n-template.json); this script takes the same rows
// as a CSV export so it runs from zero with one API key.
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { ImageStep } from "imagestep";

const args = parseArgs(process.argv.slice(2));
const refs = (args.refs || "").split(",").map((s) => s.trim()).filter(Boolean);
const rowsFile = args.rows || "rows.csv";
const outFile = args.out || rowsFile.replace(/\.csv$/i, "") + ".out.csv";
const slug = args.preset || "carousel-brand";
const perRow = Number(args["per-row"] || 4);
const model = args.model || "google/gemini-3.1-flash-image-preview";
// The subject: a handle the prompt can name, and the locked words that go with the images.
const subjectName = (args.subject || "hero").toLowerCase();
const descriptor = (args.describe || "").trim();

if (!process.env.IMAGESTEP_API_KEY) fail("set IMAGESTEP_API_KEY");
if (!refs.length) fail("--refs needs 1-3 reference images of the character / product");
if (refs.length > 4) fail("at most 4 reference images");
// Consistency has two halves. The images pin the geometry; --describe pins what a photo cannot
// state — the colour under other lighting, the material, the text on a label — and it is stored on
// the preset so it is word-for-word identical on the run three weeks from now.
if (!descriptor) fail('--describe needs the locked wording, e.g. --describe "a woman in her thirties with short silver hair"');

const client = new ImageStep({ apiKey: process.env.IMAGESTEP_API_KEY });

// 1. Reference images → assets (sha1 dedupe: re-running with the same files re-uses them).
const referenceAssetIds = [];
for (const file of refs) {
  const asset = await client.assets.upload(file, { folder: "carousel/references", wait: true });
  referenceAssetIds.push(asset.id);
  console.log(`reference ${basename(file)} → ${asset.id}`);
}

// 2. The preset: model + base prompt + one subject. Same subject → same version; changing either
//    the images or the wording is a new version, so every row below records which one produced it.
const subject = { name: subjectName, referenceAssetIds, descriptor };
const preset = await upsertPreset(slug, subject);
console.log(`preset ${preset.slug} v${preset.version} (${preset.model}) subject=${subjectName} images=${referenceAssetIds.join(",")}`);

// 3. Rows → images. The row's own prompt overrides the preset's default prompt, and it writes
//    {{subject.<name>}} rather than re-describing the subject — the server expands it to the stored
//    descriptor, so every row says the same words. Two jobs at a time (the AI concurrency limit).
const rows = parseCsv(await readFile(rowsFile, "utf8"));
if (!rows.length) fail(`${rowsFile} has no rows (needs headline, subline)`);

const estimate = await client.ops.generate(promptFor(rows[0]), { presetId: preset.id, count: perRow, dryRun: true });
console.log(`dry run: ${estimate.estimatedCredits} credits per row × ${rows.length} rows (balance ${estimate.creditBalance})`);
if (args["dry-run"]) process.exit(0);

const results = [];
for (let i = 0; i < rows.length; i += 2) {
  const batch = rows.slice(i, i + 2).map(async (row, j) => {
    const idx = i + j + 1;
    const job = await client.ops.generate(promptFor(row), {
      presetId: preset.id,
      count: perRow,
      folder: `carousel/${slugify(row.headline)}`,
      wait: { timeoutMs: 300_000, onProgress: (j) => process.stdout.write(`\rrow ${idx}: ${j.completedItems ?? 0}/${j.totalItems}`) }
    });
    const outputs = await client.jobs.outputs(job);
    const published = await client.assets.publish(outputs.map((a) => a.id));
    console.log(`\nrow ${idx} "${row.headline}": ${published.length} images, job ${job.id}`);
    return { ...row, presetVersion: preset.version, jobId: job.id, urls: published.map((a) => a.publicUrl) };
  });
  results.push(...(await Promise.all(batch)));
}

// 4. URLs back next to the rows.
const header = ["headline", "subline", "presetVersion", "jobId", ...Array.from({ length: perRow }, (_, k) => `url${k + 1}`)];
const lines = [header.join(",")];
for (const r of results) lines.push([r.headline, r.subline, r.presetVersion, r.jobId, ...r.urls].map(csvCell).join(","));
await writeFile(outFile, lines.join("\n") + "\n");
console.log(`wrote ${outFile}`);
console.log("check consistency: open url1..url4 of one row side by side — same face / product, different scene.");

function promptFor(row) {
  return `${row.headline}. ${row.subline}. Social carousel card, {{subject.${subjectName}}} as the hero, clean background with room for text, 4:5 portrait.`;
}

async function upsertPreset(slug, subject) {
  const body = {
    title: "Carousel brand character",
    slug,
    mode: "ai_image",
    model,
    prompt: `{{subject.${subject.name}}} in a fresh scene. Keep face, hair, outfit and proportions exactly as in the reference images. Clean composition, no text.`,
    parameters: { aspectRatio: "4:5", temperature: 0.6 },
    subjects: [subject]
  };
  try {
    const existing = await client.aiPresets.get(slug);
    const same = JSON.stringify(existing.subjects || []) === JSON.stringify([subject]) && existing.model === model;
    return same ? existing : client.aiPresets.update(slug, body);
  } catch (err) {
    if (err.status !== 404) throw err;
    return client.aiPresets.create(body);
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else out[key] = argv[++i];
  }
  return out;
}

// Minimal CSV: header row, quoted cells with "" escapes, no embedded newlines.
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function splitCsvLine(line) {
  const cells = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      cells.push(cur);
      cur = "";
    } else cur += c;
  }
  cells.push(cur);
  return cells;
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "row";
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
