# Assetly

A zero-dependency browser app for tracking hardware, software, and furniture assets.

## Run it

Open `index.html` directly in a browser, or serve the repository with any static file server:

```bash
python -m http.server 8000 --directory asset-tracker
```

The demo inventory is stored in browser `localStorage`, so adding an asset or changing a lifecycle status persists between visits. Use **Export** to download the current inventory as CSV.
