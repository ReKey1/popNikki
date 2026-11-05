# popNikki

A small private site for a dance team: tap your plant pot's NFC tag to log in, post a photo of your plant's growth, and dance for two minutes before it goes live.

Built with Vue 3 + TypeScript and a Hono API on Cloudflare Workers (D1 for data, R2 for files).

## Develop

Requires Node 22 (see `.nvmrc`).

```sh
npm install
npm run dev        # local dev server
npm test           # client + Worker tests
npm run lint
npm run type-check
```

## Add a dance track

Only upload a track the owner has confirmed permission for, and keep that record outside the repo. Upload the audio to R2, then add a row to D1. Drop `--remote` (and use `--local`) to try it on the dev server.

```sh
npx wrangler r2 object put popnikki-files/tracks/<file>.mp3 --file <path/to/file>.mp3 --content-type audio/mpeg --remote
npx wrangler d1 execute popnikki --remote --command "INSERT INTO tracks (title, r2_key) VALUES ('<Title>', 'tracks/<file>.mp3')"
```

With no tracks, the server publishes a post as soon as its practice starts.

See [plant-platform-plan.md](plant-platform-plan.md) for the design and [CLAUDE.md](CLAUDE.md) for project conventions.
