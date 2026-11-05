const started = new Set<string>()

/**
 * Downloads images into the browser cache at low priority, so they show at once when
 * opened later. Photos are cached as immutable, so each URL is only fetched once.
 */
export function preloadImages(urls: string[]): void {
  for (const url of urls) {
    if (started.has(url)) continue
    started.add(url)
    const img = new Image()
    img.fetchPriority = 'low'
    img.src = url
  }
}
