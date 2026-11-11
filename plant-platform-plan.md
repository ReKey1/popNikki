# Plant growth sharing platform: project plan

## How to use this document

This is a handoff from an earlier planning conversation. Nothing has been built yet.

- **Requirements** came from the project owner.
- **Proposed design** is what the earlier session recommended. The owner has not formally approved it, and they asked about Netlify and Supabase at first, so confirm the hosting choice before building.
- **Open decisions** still need the owner's input.

## Project summary

The owner will give plants to friends on their dance team. Each plant has an NFC tag that takes the person to a private website, where the team can post photos of their plants and track how much they have grown.

## Requirements

### Access and login

- Scanning a plant's NFC tag opens the website using a URL that contains a secret string.
- Only people with a tag can access the site.
- The first scan of a new tag prompts the user for a username.
- The tag is the only way to log in.

### Plant sharing

- Users can post a photo of their plant, a description, and how much it has grown.
- The main page shows a thumbnail list of each person's plant.
- The site remembers each user's last visit and shows who has posted updates and when.

### Dance exercise before posting

1. The user takes a photo and writes a description.
2. The user taps Send, which starts the music.
3. The user practices a dance for two minutes.
4. The post is published after the two minutes.

- The owner wants a playlist of about 10-20 songs.
- Music must play on the site, not through YouTube or Spotify links, which the owner finds clunky.
- The owner would like to use copyrighted music if it can be done legally.

### Cost

- Long-term cost should be as low as possible.
- The site must cope with long idle periods, such as everyone's plants dying and nobody using it. The owner originally wondered about automatically switching plans based on usage.

## Proposed design

### Hosting: Cloudflare only

| Need                   | Service               | Free allowance (checked Nov 2, 2026)                                  |
| ---------------------- | --------------------- | --------------------------------------------------------------------- |
| Pages and static files | Workers static assets | Static asset requests are free and unlimited                          |
| API and server logic   | Workers               | 100,000 requests per day                                              |
| Database               | D1 (SQLite)           | 5 million row reads per day, 100,000 row writes per day, 5 GB storage |
| Photos and music       | R2                    | 10 GB storage, no egress fees                                         |

Expected cost is $0 plus a domain at roughly $10-15 per year (a rough estimate, not checked). Scale-to-zero pricing removes the need for automatic plan switching.

Why not the alternatives:

- **Supabase:** Free projects pause after 7 days of inactivity and must be restored manually, so a quiet week would take the site down. Pro costs $25 per month. Supabase Auth also wouldn't help much with tag-only login.
- **Netlify:** It would work for hosting (300 free credits per month, paid plans from $9), but it adds a second provider without much benefit.

To check:

- Whether R2 requires a card on file. This is from memory and wasn't confirmed.
- Current prices and limits before launch.

### Architecture

```text
NFC tag on the pot
  -> phone browser (session cookie after first tap)
  -> Cloudflare Worker + static site
       -> D1: users, sessions, posts, views, tracks
       -> R2 (private): photos, thumbnails, music
```

### NFC tags

- Use NTAG213 stickers. They hold a URL of around 130 characters, and a 10-pack costs about $7.
- iPhone XS/XR and newer can read them in the background.
- Attach each tag to the pot or a plant marker, not the plant, so a dead plant doesn't lose the login. Use a waterproof tag.
- Metal pots can block NFC, so test on the actual pot.
- Use a domain the owner will keep, not a provider subdomain. Locked tags can't be changed, but a custom domain allows a later host change.
- Test each tag on iPhone and Android before permanently locking it. Locking cannot be undone.

### Login and security

The token doesn't need encryption. Use a random 128-bit value, base64url-encoded (22 characters), with a URL such as:

`https://DOMAIN/tag?t=<token>`

Tag creation:

1. A provisioning script generates the token and URL for each tag.
2. It stores only the SHA-256 hash of the token in D1.
3. The owner writes the URL to the tag, tests it, and locks it.

Tap flow:

1. `GET /tag?t=<token>` hashes the token and looks it up.
2. An unknown or revoked token returns a generic 404.
3. An unclaimed token sets a short-lived claim cookie and redirects to the username form.
4. A claimed token creates a session and redirects to `/`.

Rules:

- Always redirect so the token doesn't stay in the address bar. Also set `Referrer-Policy: no-referrer`.
- Use long-lived, server-set cookies with `HttpOnly`, `Secure`, and `SameSite=Lax`. Store only a hash of the session token.
- Don't rely on `localStorage` for login, because Safari may clear it after a period without use.
- Tapping the tag on a new device creates a new session for that device.
- Provide an admin script that revokes a tag, deletes its sessions, and can issue a replacement token for the same user (`npm run users:revoke`).

Known limitation: anyone who taps a tag or obtains its URL can log in as that person. This is accepted for a group of friends. NTAG 424 DNA tags generate a new code per tap and stop copied links from working, but they cost more and take more work.

### Data model

The schema is in [migrations/0001_initial_schema.sql](migrations/0001_initial_schema.sql). In summary:

- `users`: one row per tag. It holds `token_hash` (SHA-256 of the tag token), `username` (NULL until claimed, unique ignoring case), `last_login_at` and `revoked_at`. Replacing a tag means a new `token_hash` on the same row.
- `sessions`: one row per logged-in device, keyed by the SHA-256 hash of its cookie.
- `posts`: growth entries with `description`, `photo_key`, `thumb_key`, `track_id`, `music_started_at` and `dance_seconds`. A post is a draft while `published_at` is NULL.
- `rolls`: one row per member with the roulette's result for their next post (`seconds` and `track_id`). It is deleted when a post is published (migration 0004).
- `tracks`: the playlist, with just a `title` and an `r2_key` (simplified in migration 0002).
- `plant_views`: `(viewer_id, owner_id) -> last_viewed_at`, for update badges.

Choices behind it:

- Ids are `INTEGER PRIMARY KEY`. Timestamps are `INTEGER` Unix epoch milliseconds (`Date.now()`).
- Rows for a user are removed with them (`ON DELETE CASCADE`).
- `posts(user_id, published_at)` is indexed for the main page and plant history.
- Height isn't stored (open decision 6). A later migration can add it.

### Main page and update badges

- Show one thumbnail per plant, using its newest published photo, with the owner's name and last update time.
- Show an update badge when a plant's newest `published_at` is later than the viewer's `last_viewed_at` for that plant.
- Clear the badge only when the viewer opens that plant. Tracking this per plant means a page refresh won't clear unopened updates.

### Photos

- Resize in the browser before upload: about 1600 px on the long edge, plus a thumbnail of about 400 px.
- Re-encoding should strip GPS data and other EXIF metadata. Test this, because the photos are taken at people's homes.
- Keep the R2 bucket private. The Worker checks the session before serving any file.
- Validate file type and size on the server.

Rough storage estimate: 20 people posting a 350 KB photo weekly adds about 365 MB per year, so 10 GB should last 25+ years.

### Dance flow

When the user taps Send:

1. The photo and description upload in the background, so a crash or closed tab doesn't lose them.
2. The user spins the roulette. The server rolls a dance time from 0 to 180 seconds (two minutes on average) and a track that avoids the user's last few songs, and keeps that roll until a post is published. Spinning again, quitting or deleting the draft returns the same roll.
3. The user taps Start, which starts the audio, since mobile browsers need a user gesture. The server copies the roll to the draft and records `music_started_at`.
4. Screen Wake Lock keeps the screen on where supported.
5. Music and the on-screen timer pause if the user leaves the page, then resume when they return.
6. When the rolled time is up, the client requests publication.
7. The server publishes only if the files are present and the rolled time has passed since `music_started_at`. A roll of zero seconds publishes at Start.

Roulette odds: by default the times average two minutes. A member with fewer than five posts, or whose last post was more than three days ago (fully at two weeks), is likelier to roll a short dance. The owner wants this kept from the members, so it is never sent to the page or shown.

Notes:

- The server enforces the rolled time, so changing the browser timer can't skip it.
- A browser-side pause can't be fully enforced by the server. This is acceptable for a friendly group.
- The timer proves that time passed, not that anyone danced. Start with the honor system. Motion-sensor checks are an optional later idea.
- Fade the music out when the timer ends if a track is longer than the dance.
- Add a scheduled cleanup for abandoned drafts and their R2 files.

### Music delivery

- A 10-20 song playlist is light. Twenty two-minute MP3s at 128-192 kbps take about 40-60 MB, and twenty four-minute songs at 192 kbps take about 115 MB.
- Each play uses about 2-3 MB of the dancer's mobile data for a two-minute clip.
- Serve audio through the Worker with session checks and HTTP Range support, which Safari expects for media.

### Music licensing

This is planning guidance, not legal advice. Assume Japan, based on the owner's time zone, and confirm this.

- Buying a track generally doesn't grant the right to upload it and stream it to others from a website.
- Commercial recordings generally need clearance for the composition, often through JASRAC, and usually permission from the record label.
- A login-protected site reduces exposure but isn't a clear exemption. Japanese law treats a large number of specific people as "the public" without setting a clear number.

**Do not upload a commercial recording unless the owner has confirmed the required permissions.**

Options, in the order previously recommended:

1. Original music from a team member or local producer, with written permission for site use.
2. A one-time licence that explicitly covers website or web app playback. Standard creator subscriptions may not cover this.
3. Creative Commons music that allows this use, with attribution where required.
4. Direct permission for specific songs, which is the only reliable way to use those exact recordings.

Fallback: name a song and run the timer while each dancer plays it from their own music app. No audio is hosted, but this doesn't meet the owner's preference for playback on the site.

If a track will be shortened to two minutes, check that its licence allows that.

## Open decisions

1. Approve Cloudflare, or stay with Netlify and Supabase?
2. ~~What domain name will the site use?~~ Decided: `pop-nikki.party`.
3. Which music option will the team use, and for which songs?
4. How many team members and tags are needed?
5. Which language or languages should the interface use?
6. ~~Should height be entered as a current measurement?~~ Decided: no height for now. Posts have a photo, a description and a date.

## Suggested build order

1. Confirm the open decisions that affect the build.
2. Set up the Worker, D1, R2, and schema migrations.
3. Build the token provisioning script and tag login flow.
4. Add sessions, username claiming, and tag revocation.
5. Build posting, photo processing, and protected file delivery.
6. Build the main page, plant history, and update badges.
7. Add the two-minute music flow, using a properly licensed test track.
8. Test on real iPhone and Android devices, including NFC scanning, audio start, screen wake, and a return after leaving the page.
9. Write and lock the real tags only after the domain and login flow are final.

## Sources for prices and legal notes

- [Supabase pricing guide](https://www.nocode.mba/articles/supabase-pricing)
- [Netlify pricing](https://www.hackceleration.com/labs/netlify-pricing)
- [Cloudflare D1 free tier](https://freetier.co/articles/cloudflare-d1-free-tier-limits-pricing-and-alternatives)
- [Cloudflare free tier limits](https://eastondev.com/blog/en/posts/dev/20260526-cloudflare-free-limits/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/index.md)
- [NTAG213 reference](https://www.wakdev.com/en/knowledge-base/nfc-chips/nxp-ntag213.html)
- [NFC tag listings](https://www.walmart.com/c/kp/nfc-tags-range)
- [Business Lawyers: using commercial CDs on a website](https://www.businesslawyers.jp/practices/604)
- [AXIES: "the public" under Japanese copyright law](https://copyright-edu.axies.jp/sugowaka35/en/copyright04/)
- [Japan copyright law text (WIPO)](https://tind.wipo.int/record/38445/files/HJC_cr_1971_05_en.pdf)
- [Foximusic: music licensing for apps](https://www.foximusic.com/blog/es/?p=792)
