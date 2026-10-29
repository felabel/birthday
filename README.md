# Keepsake ♥

An animated one-page birthday card: an envelope that opens, a card that unfolds, and memories that glide in as you scroll.

## Edit the card (on your computer)

```
PORT=3001 node server.js
```

Open http://localhost:3001, log in, and edit the card: photos, captions, letter, things you love, song and colour theme.

## Put it online (Vercel)

1. Export the card into `site/`:
   ```
   npm run export
   ```
2. Commit and push:
   ```
   git add -A && git commit -m "Update card" && git push
   ```
3. Vercel serves `site/` as a static website (see `vercel.json`). Every push redeploys it.

`data/` (accounts) and `uploads/` (original files) are not committed. Only the exported card in `site/` is.
