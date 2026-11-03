import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'

const app = new Hono<{ Bindings: Env }>()

app.use(secureHeaders({ referrerPolicy: 'no-referrer' }))

app.get('/api/', (c) => c.json({ name: 'Cloudflare' }))

export default app
