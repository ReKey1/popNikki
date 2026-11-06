import { describe, expect, it } from 'vitest'

import { buildTracks } from '../tracks.ts'

describe('buildTracks', () => {
  it('uses the file name as the title and a slug of it as the key', () => {
    const { uploads, sql } = buildTracks(['Golden Hour.mp3', 'Beat (Remix).M4A'])
    expect(uploads).toEqual([
      { file: 'Golden Hour.mp3', key: 'tracks/golden-hour.mp3', contentType: 'audio/mpeg' },
      { file: 'Beat (Remix).M4A', key: 'tracks/beat-remix.m4a', contentType: 'audio/mp4' },
    ])
    expect(sql).toContain("SELECT 'Golden Hour', 'tracks/golden-hour.mp3'")
    expect(sql).toContain("SELECT 'Beat (Remix)', 'tracks/beat-remix.m4a'")
  })

  it('keeps letters from any script in the key', () => {
    expect(buildTracks(['夜の ダンス.mp3']).uploads[0]!.key).toBe('tracks/夜の-ダンス.mp3')
  })

  it('escapes quotes in the SQL', () => {
    const { sql } = buildTracks(["Don't Stop.mp3"])
    expect(sql).toContain("SELECT 'Don''t Stop', 'tracks/don-t-stop.mp3'")
  })

  it('only adds a track whose key is not on the playlist yet', () => {
    const { sql } = buildTracks(['a.mp3'])
    expect(sql).toContain("WHERE NOT EXISTS (SELECT 1 FROM tracks WHERE r2_key = 'tracks/a.mp3')")
  })

  it('skips files that are not supported audio', () => {
    const { uploads, skipped } = buildTracks(['song.wav', 'notes.txt', '.mp3', '!!!.mp3', 'ok.mp3'])
    expect(uploads.map((u) => u.file)).toEqual(['ok.mp3'])
    expect(skipped).toEqual(['song.wav', 'notes.txt', '.mp3', '!!!.mp3'])
  })
})
