export type Me = { id: number; username: string }
export type Plant = {
  id: number
  username: string
  post_id: number | null
  published_at: number | null
}
export type Post = { id: number; description: string; published_at: number }

/** Reads the `error` message from a failed API response. */
export async function errorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? `Something went wrong (${res.status})`
}

export const formatDate = (ms: number) => new Date(ms).toLocaleString()
