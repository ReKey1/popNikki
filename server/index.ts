import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { secureHeaders } from 'hono/secure-headers'

import type { AppEnv } from './lib/session'
import auth from './routes/auth'
import posts from './routes/posts'
import reactions from './routes/reactions'
import roll from './routes/roll'
import tracks from './routes/tracks'

const app = new Hono<AppEnv>()

// The Worker only sends data, photos and audio, never a page: its responses may load nothing
// and can't be framed. The pages get their own headers from `public/_headers`.
app.use(
  secureHeaders({
    referrerPolicy: 'no-referrer',
    xFrameOptions: 'DENY',
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  }),
)
// Members' data is never stored by a browser or proxy. Photos and audio set their own caching.
app.use(async (c, next) => {
  await next()
  if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store')
})
app.use('/api/*', csrf())

app.route('/', auth)
app.route('/', posts)
app.route('/', reactions)
app.route('/', roll)
app.route('/', tracks)

export default app
