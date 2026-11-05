import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { secureHeaders } from 'hono/secure-headers'

import type { AppEnv } from './lib/session'
import auth from './routes/auth'
import posts from './routes/posts'

const app = new Hono<AppEnv>()

app.use(secureHeaders({ referrerPolicy: 'no-referrer' }))
app.use('/api/*', csrf())

app.route('/', auth)
app.route('/', posts)

export default app
