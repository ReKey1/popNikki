# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A private site for a dance team. Scanning a plant pot's NFC tag logs the user in. Users post plant growth photos, and each post is published only after a dance with music, for a time and to a song that a roulette picks. [plant-platform-plan.md](plant-platform-plan.md) is the design handoff: requirements, proposed schema, login and dance flows, and open decisions. Read the relevant section before building a feature.

Hosting is **Cloudflare**, which has been confirmed. The domain is `pop-nikki.party`. Remaining open decisions are in the plan.

## Commands

| Task                                                                               | Command                                                                                                                                              |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dev server (Vite with the Worker in workerd)                                       | `npm run dev`                                                                                                                                        |
| All tests, once                                                                    | `npm test`                                                                                                                                           |
| One project or file                                                                | `npx vitest run --project server server/__tests__/index.test.ts`                                                                                     |
| Tests in watch mode                                                                | `npm run test:watch`                                                                                                                                 |
| Lint, with auto-fix (oxlint, then ESLint)                                          | `npm run lint`                                                                                                                                       |
| Format / check format                                                              | `npm run format` / `npm run format:check`                                                                                                            |
| Type-check (`vue-tsc --build`, all tsconfigs)                                      | `npm run type-check`                                                                                                                                 |
| Build (type-check + Vite build)                                                    | `npm run build`                                                                                                                                      |
| Regenerate `worker-configuration.d.ts` after changing bindings in `wrangler.jsonc` | `npm run cf-typegen`                                                                                                                                 |
| New D1 migration / apply locally / apply to prod                                   | `npx wrangler d1 migrations create <db> <name>` / `npx wrangler d1 migrations apply <db> --local` / `npx wrangler d1 migrations apply <db> --remote` |
| Production build in local workerd / deploy                                         | `npm run preview` / `npm run deploy`                                                                                                                 |

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint (without fixing), the format check, type-check, tests and the build on every push and PR. **Run `npm run lint`, `npm run type-check` and `npm test` before pushing.**

## Branches

- **`dev`** is the default branch. All work and Dependabot updates land here, either directly or through feature-branch PRs into `dev`.
- **`prod`** is the released code. A GitHub ruleset blocks direct pushes, force-pushes and deletion, so it changes only through a PR from `dev` with a passing `check` CI job.
- Never push to or merge into `prod` without the owner's go-ahead.

## Cloudflare resources

- Account login is done with `wrangler login`.
- **D1:** the database is `popnikki` (binding `DB`, location hint APAC). The schema is in `migrations/` and is applied both locally and remotely.
- **R2:** the bucket is `popnikki-files` (binding `FILES`, location hint APAC). It is created, and public `r2.dev` access is disabled. Keep it that way.
- Local dev and tests use local simulations of both, so they don't need the real resources.
- **Domain:** `pop-nikki.party`, attached as a Worker custom domain in `wrangler.jsonc`, with `workers.dev` and preview URLs turned off. Tag URLs are built from it, so don't change it.
- **Deploying** is manual: `npm run deploy`, run from the merged `prod` code.

## Architecture

The project was scaffolded with Cloudflare's official tool (`npm create cloudflare -- --framework=vue`). Lint, format and test configs come from `create-vue`. One Worker serves both halves:

- **`src/`**: the Vue 3 + TypeScript SPA, using Vue Router. It is built by Vite into static assets.
- **`server/`**: the Worker API, a Hono app (`new Hono<{ Bindings: Env }>()`). The `Env` type comes from the generated `worker-configuration.d.ts`.
- **Routing** is set in `wrangler.jsonc` under `assets`. `not_found_handling: single-page-application` serves `index.html` for page loads and navigation, and those requests **never reach the Worker** unless their path matches `run_worker_first`. Every server route must be listed there.
  - `/api/*` is listed today.
  - The NFC entry point `/tag` must be added when it is built, because a tag tap is a navigation request.
- **Page headers:** the Worker's headers only reach `/api/*` and `/tag`. The pages and their files get theirs from [public/_headers](public/_headers) (the CSP, and a year of caching for Vite's hashed `/assets/*`).
- **D1** (SQLite) holds data, with schema changes only through `migrations/`. **R2** holds photos and audio.
- **Speed:** a visit must draw without waiting for the server. The session and garden stores keep the viewer and the garden in `localStorage` (VueUse `useLocalStorage`), every page a member moves between is in the main bundle, and the Japanese font CSS loads after the first paint (`src/assets/fonts-japanese.css`).
- **Look and motion:** every colour, size, easing and duration is a token in `src/assets/tokens.css`. Use the tokens, never raw values. Shared entrances are classes in `src/assets/motion.css` (`pn-page` for a page stepped forward to, `pn-stagger` for a list), and they don't replay when going back. A page that isn't paper calls `usePageColor`, so the browser's toolbars and overscroll match it.
- **Sheets** (`BaseSheet`) hang from the top of the screen at `100dvh` with the panel at the bottom. Don't anchor one to the dialog's bottom edge: that put it under Safari's toolbar on iPhones with the address bar at the bottom.
- **Tests:** there are two Vitest projects in [vitest.config.ts](vitest.config.ts).
  - `client`: jsdom + `@vue/test-utils`, for `src/**/__tests__/*.spec.ts`.
  - `server`: `@cloudflare/vitest-plugin`, which runs the tests inside workerd with the real bindings from `wrangler.jsonc`, for `server/**/__tests__/*.test.ts`.
  - Test Hono routes with `app.request()`.
  - D1 follows Cloudflare's test recipe. `vitest.config.ts` reads `migrations/` with `readD1Migrations`, and `server/__tests__/apply-migrations.ts` applies them before each test file. Use `env` from `cloudflare:workers`.
- **TypeScript project references:** `tsconfig.app.json` covers `src`, `tsconfig.worker.json` covers `server`, `tsconfig.vitest.json` covers the client tests, and `tsconfig.node.json` covers the config files.

## Rules from the owner

- **Follow official conventions for everything:** file layout, Wrangler config, migrations, Vue style and test placement. Use Cloudflare's, Vue's and Hono's docs. When unsure, check the docs or the existing code. Never assume a structure.
- **Don't hand-roll what a common library already does.** Prefer the platform and existing dependencies first (Hono middleware and helpers, Web APIs), then a well-known package.
- **Keep it minimal.** Choose ease of use over clever mechanisms.
- **Keep the interface sleek.** Add no text the design can do without. Never present a long practice as a bad result, or a short one as a win: every roulette result looks the same.
- **Every change ships with tests.**
- **Security and privacy are checked on every change.** See below.
- The `cloudflare` and `vuejs-ai` skills are enabled in [.claude/settings.json](.claude/settings.json). The Vue skills are a community project, so official Vue docs win any conflict.
- A Playwright MCP is set up in [.mcp.json](.mcp.json) for checking the UI at phone size against `npm run dev`.

## Security and privacy

The **repo is public.** Never commit tag tokens, tag URLs, provisioning output (`secrets/` and `tags/` are gitignored), music files (`music/` is gitignored), `.dev.vars`, real photos or user data. Real secrets go in `wrangler secret`.

- **Login tokens:** store only SHA-256 hashes of tag tokens and session tokens. `/tag?t=` must always redirect, so the token leaves the address bar. Unknown or revoked tokens return a generic 404.
- **Referrer policy:** `Referrer-Policy: no-referrer` is set by `hono/secure-headers` in `server/index.ts`.
- **Sessions** use server-set `HttpOnly; Secure; SameSite=Lax` cookies (`hono/cookie`). Never use `localStorage` for login, because Safari clears it. A tag tap replaces the session that device had and clears expired ones. Logging out sends `Clear-Site-Data`, which removes the photos and data the browser kept.
- **What the device remembers** (`localStorage`: the viewer's name and the garden list) is for drawing the first screen only. It grants nothing: the server checks the cookie on every request. It is cleared on logout, when the server says the session is over, and when another member logs in on the device. Keep nikki text and drafts out of it.
- **Headers:** the Worker's responses and the pages both send a strict CSP, `frame-ancestors 'none'` and `nosniff`. Worker responses default to `Cache-Control: no-store`. Only photos and audio set their own caching.
- **A lost or leaked tag** is shut out with `npm run users:revoke -- <username>` (add `--replace` for a new link on the same account). It also deletes the member's sessions.
- **Usernames** are tidied on the server (NFKC, no invisible or control characters), so one name can't pass for another.
- **R2 stays private.** Every photo and audio file goes through the Worker, which checks the session first. Audio responses must support HTTP Range requests for Safari.
- **The dance time is rolled and enforced on the server.** The roulette (`server/lib/roulette.ts`) lands on 0 to 180 seconds, two minutes on average. A member has one roll (`rolls` table) from their first spin until a nikki is published, so quitting, deleting a draft or spinning again never changes it. `POST /api/posts/:id/start` copies it to the draft, and publishing is checked against `music_started_at`. The client timer is not trusted. The post is published at once on a roll of zero seconds and, as the owner chose, when the `tracks` table is empty. Both decisions are made on the server.
- **The roulette's odds are secret.** Members with few nikki, or none for a while, are likelier to roll a short dance. The owner wants this never shown or hinted at: no API response carries the odds, and the page shows every result the same way.
- **Photos:** resize and re-encode in the browser to strip EXIF and GPS data (about 1600 px, plus a thumbnail of about 400 px). The server checks the type, the size and that the bytes start like a JPEG, and stops at 20 unposted drafts per member.
- **Update badges** are tracked per plant in `plant_views` and cleared only when the viewer opens that plant.
- **Music licensing:** never add a commercial recording to the repo or to R2 without the owner's confirmed permission. Tracks store only a `title` and an `r2_key`, so keep the record of each song's permission outside the repo.
