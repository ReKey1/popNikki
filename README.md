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

See [plant-platform-plan.md](plant-platform-plan.md) for the design and [CLAUDE.md](CLAUDE.md) for project conventions.
