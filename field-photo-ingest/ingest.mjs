// Field photo ingest: a folder of phone photos (HEIC) → upload → EXIF date + GPS → label
// `YYYY-MM/<lat,lon>` → publish → manifest CSV with stable URLs. No reverse geocoding: coords only.
//
//   IMAGESTEP_API_KEY=mm_sk_… node ingest.mjs ./photos [--out manifest.csv] [--concurrency 4]
import { readdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { ImageStep } from "imagestep";

const argv = process.argv.slice(2);
const dir = argv.find((a) => !a.startsWith("--"));
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const outFile = opt("out", dir ? join(dir, "manifest.csv") : "manifest.csv");
const concurrency = Number(opt("concurrency", 4));
const EXTENSIONS = new Set([".heic", ".heif", ".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".dng"]);

if (!process.env.IMAGESTEP_API_KEY) fail("set IMAGESTEP_API_KEY");
if (!dir) fail("usage: node ingest.mjs ./photos");

const client = new ImageStep({ apiKey: process.env.IMAGESTEP_API_KEY });
const files = (await readdir(dir)).filter((f) => EXTENSIONS.has(extname(f).toLowerCase())).sort();
if (!files.length) fail(`no photos in ${dir}`);
console.log(`${files.length} photos, ${concurrency} at a time`);

const rows = [];
let next = 0;
await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));

rows.sort((a, b) => a.file.localeCompare(b.file));
const header = ["file", "assetId", "takenAt", "latitude", "longitude", "label", "width", "height", "publicUrl"];
const csv = [header.join(","), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(","))].join("\n") + "\n";
await writeFile(outFile, csv);
console.log(`wrote ${outFile} (${rows.length} rows)`);

async function worker() {
  while (next < files.length) {
    const file = files[next++];
    try {
      rows.push(await ingest(file));
    } catch (err) {
      console.error(`${file}: ${err.code || ""} ${err.message}`);
      rows.push({ file, label: "failed", publicUrl: "" });
    }
  }
}

async function ingest(file) {
  // 1. Upload; `wait` returns once the ingest pipeline has written dimensions + EXIF (status DONE).
  const asset = await client.assets.upload(join(dir, file), { wait: true });

  // 2. read_metadata is sync — the asset already carries it.
  const { metadata, basicInfo } = await client.ops.readMetadata(asset.id);
  const takenAt = metadata?.dateTimeOriginal ? new Date(metadata.dateTimeOriginal) : null;
  const month = takenAt ? takenAt.toISOString().slice(0, 7) : "unknown-date";
  const lat = metadata?.gpsLatitude;
  const lon = metadata?.gpsLongitude;
  const place = typeof lat === "number" && typeof lon === "number" ? `${lat.toFixed(3)},${lon.toFixed(3)}` : "no-gps";
  const label = `${month}/${place}`;

  // 3. Label (a collection label, not a folder tree) and publish.
  await client.assets.label(asset.id, label);
  const [published] = await client.assets.publish(asset.id);
  console.log(`${file} → ${label} → ${published.publicUrl}`);

  return {
    file,
    assetId: asset.id,
    takenAt: takenAt ? takenAt.toISOString() : "",
    latitude: typeof lat === "number" ? lat : "",
    longitude: typeof lon === "number" ? lon : "",
    label,
    width: basicInfo?.width ?? "",
    height: basicInfo?.height ?? "",
    publicUrl: published.publicUrl
  };
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
