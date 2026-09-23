// Field photo ingest: a folder of phone photos (HEIC) → upload → EXIF date + GPS → collection
// `YYYY-MM/<lat,lon>` → publish → manifest CSV with stable URLs. No reverse geocoding: coords only.
//
//   IMAGESTEP_API_KEY=is_sk_… node ingest.mjs ./photos [--out manifest.csv] [--concurrency 4]
//
// IMAGESTEP_BASE_URL points it at another API host.
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

const client = new ImageStep({ apiKey: process.env.IMAGESTEP_API_KEY, baseUrl: process.env.IMAGESTEP_BASE_URL });
const files = (await readdir(dir)).filter((f) => EXTENSIONS.has(extname(f).toLowerCase())).sort();
if (!files.length) fail(`no photos in ${dir}`);
console.log(`${files.length} photos, ${concurrency} at a time`);

const rows = [];
let next = 0;
await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));

rows.sort((a, b) => a.file.localeCompare(b.file));
const header = ["file", "assetId", "takenAt", "latitude", "longitude", "collection", "width", "height", "publicUrl"];
const csv = [header.join(","), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(","))].join("\n") + "\n";
await writeFile(outFile, csv);
console.log(`wrote ${outFile} (${rows.length} rows)`);
// One line a program can read: what this run made.
console.log(JSON.stringify({ recipe: "field-photo-ingest", rows: rows.map(({ file, assetId, collection }) => ({ file, assetId, collection })) }));

async function worker() {
  while (next < files.length) {
    const file = files[next++];
    try {
      rows.push(await ingest(file));
    } catch (err) {
      console.error(`${file}: ${err.code || ""} ${err.message}`);
      rows.push({ file, collection: "failed", publicUrl: "" });
    }
  }
}

async function ingest(file) {
  // 1. Upload; `wait` returns once ingest has written dimensions + EXIF (status DONE).
  const asset = await client.assets.upload(join(dir, file), { wait: true });

  // 2. read_metadata is synchronous — the asset already carries it, under exiftool's names:
  //    DateTimeOriginal as an ISO date, GPSLatitude / GPSLongitude as signed decimals.
  const { metadata, image } = await client.ops.readMetadata(asset.id);
  const takenAt = metadata?.DateTimeOriginal ? new Date(metadata.DateTimeOriginal) : null;
  const month = takenAt && !Number.isNaN(takenAt.getTime()) ? takenAt.toISOString().slice(0, 7) : "unknown-date";
  const lat = parseFloat(metadata?.GPSLatitude);
  const lon = parseFloat(metadata?.GPSLongitude);
  const hasGps = Number.isFinite(lat) && Number.isFinite(lon);
  const collection = `${month}/${hasGps ? `${lat.toFixed(3)},${lon.toFixed(3)}` : "no-gps"}`;

  // 3. Into its collection (a flat label, not a folder tree), then publish.
  await client.assets.setCollection(asset.id, collection);
  const [published] = await client.assets.publish(asset.id);
  console.log(`${file} → ${collection} → ${published.publicUrl ?? "(no public host configured)"}`);

  return {
    file,
    assetId: asset.id,
    takenAt: month === "unknown-date" ? "" : takenAt.toISOString(),
    latitude: hasGps ? lat : "",
    longitude: hasGps ? lon : "",
    collection,
    width: image?.width ?? "",
    height: image?.height ?? "",
    publicUrl: published.publicUrl ?? ""
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
