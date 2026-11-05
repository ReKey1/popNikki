/** The emoji a member can react with. The server checks the same set in `server/routes/reactions.ts`. */
export const REACTIONS = ['🔥', '💧', '🌱', '🕺', '😮', '❤️']

/** Turns reaction counts into a meta line such as "🔥 4 · 💧 2", most popular first. */
export function reactionSummary(counts: Record<string, number>): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([emoji, n]) => `${emoji} ${n}`)
    .join(' · ')
}
