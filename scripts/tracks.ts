/** Audio formats every target browser plays, including Safari on iPhone. */
export const AUDIO_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
}

export type TrackUpload = { file: string; key: string; contentType: string }
export type NewTracks = { uploads: TrackUpload[]; sql: string; skipped: string[] }

const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`

/**
 * Plans the upload of the given audio file names. The name without its extension becomes the
 * title, and a slug of it becomes the R2 key. The SQL only adds tracks that aren't there yet,
 * so running it again is harmless.
 */
export function buildTracks(fileNames: string[]): NewTracks {
  const uploads: TrackUpload[] = []
  const skipped: string[] = []
  const rows: string[] = []
  for (const file of fileNames) {
    const dot = file.lastIndexOf('.')
    const ext = dot > 0 ? file.slice(dot).toLowerCase() : ''
    const contentType = AUDIO_TYPES[ext]
    const title = file.slice(0, dot).trim()
    // Letters in any script are kept, so non-Latin titles still get a readable key.
    const slug = title
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
    if (!contentType || !slug) {
      skipped.push(file)
      continue
    }
    const key = `tracks/${slug}${ext}`
    uploads.push({ file, key, contentType })
    rows.push(
      `INSERT INTO tracks (title, r2_key) SELECT ${sqlString(title)}, ${sqlString(key)}\n` +
        `  WHERE NOT EXISTS (SELECT 1 FROM tracks WHERE r2_key = ${sqlString(key)});`,
    )
  }
  return { uploads, sql: rows.join('\n') + '\n', skipped }
}
