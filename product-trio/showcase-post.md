# r/n8n showcase draft — "Drop a product photo in Drive, get three listing-ready variants in a Sheet"

**What I built**

Our shop photographs each product once. The listing needs three files from that shot: a
transparent cut-out for ads, a white-background packshot for the marketplace, and a 1200 px
version for the product page. That was a Photoshop chore; now it is a Drive folder.

**The workflow** (9 nodes, three in parallel)

1. **Google Drive Trigger** on `product-photos` → **Google Drive** download.
2. **ImageStep → Asset → Upload** once — the node stages, PUTs and finishes the upload and returns
   an asset id.
3. Three **ImageStep → Operation** nodes fan out from that id: `remove_bg` (AI), `pad` 120 px white
   (deterministic), `resize` 1200 inside (deterministic). Each is its own job and publishes its
   output.
4. **Merge** (3 inputs) → **Code** (one row per variant) → **Google Sheets** append
   `file, variant, publicUrl, width, height, jobId`.

**The result**

A photo dropped at 09:00 has three rows in the sheet by 09:01, with URLs that do not change. The
deterministic ops are near-instant; the cut-out is the only one that costs anything, and *Dry Run*
shows the price first. Nothing is re-generated — all three come from the same pixels, so the
product in the packshot is the product in the cut-out. Next: chain `pad` after the cut-out as a
saved preset, so the packshot is the cut-out on white.

Template and a 60-line SDK version:
[imagestep-recipes/product-trio](https://github.com/jun-zhang-pro/imagestep-recipes/tree/main/product-trio)
