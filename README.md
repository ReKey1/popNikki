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

Only upload a track the owner has confirmed permission for, and keep that record outside the repo.

Put `.mp3` (or `.m4a`) files in `music/`, which is gitignored. The file name becomes the title, so `music/Golden Hour.mp3` plays as "Golden Hour". Any length works: the music fades in, fades out at two minutes, and loops if the song is shorter. Then run:

```sh
npm run tracks:add               # local, for the dev server
npm run tracks:add -- --remote   # production
```

It uploads each file to R2 and adds it to the `tracks` table. Running it again re-uploads the files but doesn't add duplicates. With no tracks, the server publishes a post as soon as its practice starts.

See [plant-platform-plan.md](plant-platform-plan.md) for the design and [CLAUDE.md](CLAUDE.md) for project conventions.
