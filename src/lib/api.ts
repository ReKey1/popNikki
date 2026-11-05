export type Me = { id: number; username: string }
export type Plant = {
  id: number
  username: string
  post_id: number | null
  published_at: number | null
  post_count: number
  first_published_at: number | null
  /** The newest nikki is newer than the viewer's last visit. */
  unseen: boolean
}
export type Post = {
  id: number
  description: string
  published_at: number
  /** Count per emoji. */
  reactions: Record<string, number>
  my_reaction: string | null
}
export type PlantPosts = { owner: Me; posts: Post[] }
/** A post that hasn't been danced out yet. */
export type Draft = { id: number; description: string; created_at: number }
/** The answer to starting the music: a track, or published at once when there is none. */
export type StartResult = { track: { id: number; title: string } } | { published: true }

/** Reads the `error` message from a failed API response. */
export async function errorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? `Something went wrong (${res.status})`
}

/** Sets (or, with `null`, removes) the viewer's reaction on a post. */
export function setReaction(postId: number, emoji: string | null): Promise<Response> {
  const url = `/api/posts/${postId}/reaction`
  return emoji
    ? fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
    : fetch(url, { method: 'DELETE' })
}

/** One member's reaction on a post. */
export type Reactor = { emoji: string; username: string }

/** Who reacted to a post, oldest first. */
export function fetchReactors(postId: number): Promise<Response> {
  return fetch(`/api/posts/${postId}/reactions`)
}
