# Plan 124: Compression Streams for Export Files

**Gap:** The CSV/JSON export (Plan 34) generates uncompressed text files. For large exports (alliance roster with history), file sizes can be tens of KB — compressible by 80%+.

**Best practice (WICG):** Use the Compression Streams API (`CompressionStream`) to Gzip-compress export files before download. Reduces file size and download time.

---

## Step 1: Add compression to CSV export

```js
async function exportCompressedCSV() {
  var data = buildExportData();
  var csv = buildCSV(data); // existing function

  // Compress using CompressionStream
  var blob = new Blob([csv], { type: 'text/csv' });
  var compressed = await compressBlob(blob);

  downloadFile(compressed, 'gem-rewards-export.csv.gz', 'application/gzip');
}

async function compressBlob(blob) {
  var stream = blob.stream();
  var compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
  var chunks = [];

  for await (var chunk of compressedStream) {
    chunks.push(chunk);
  }

  return new Blob(chunks, { type: 'application/gzip' });
}
```

---

## Step 2: Add uncompressed fallback

```js
function exportCSV() {
  if ('CompressionStream' in window) {
    exportCompressedCSV();
  } else {
    // Fallback to uncompressed
    var csv = buildCSV(buildExportData());
    downloadFile(csv, 'gem-rewards-export.csv', 'text/csv');
  }
}
```

---

## Step 3: Add decompression note

Since most users won't have a Gzip extractor, offer both options:

```html
<button onclick="exportCSV()">Download CSV</button>
<button onclick="exportCompressedCSV()">Download CSV (compressed)</button>
```

---

## Step 4: Measure compression ratio

```bash
# Expected: 3-5 KB CSV → 0.5-1 KB Gzip (80-90% reduction)
```

---

## Files Modified: `script.js`, `index.html`
