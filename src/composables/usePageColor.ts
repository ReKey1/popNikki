import { onScopeDispose, toValue, watchEffect, type MaybeRefOrGetter } from 'vue'

/** The page colours other than paper. `main.css` gives the body the matching background. */
export type PageColor = 'night' | 'moss'

/**
 * Paints the browser around the page in the page's own colour for as long as the page is open:
 * its toolbars, and what shows when the page is pulled past its end. A page that doesn't call
 * this is paper.
 */
export function usePageColor(color: MaybeRefOrGetter<PageColor>) {
  const root = document.documentElement

  function paint(page?: PageColor) {
    if (page) root.dataset.page = page
    else delete root.dataset.page
    // The toolbar takes the colour the stylesheet has just given the body.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', getComputedStyle(document.body).backgroundColor)
  }

  watchEffect(() => paint(toValue(color)))
  onScopeDispose(() => paint())
}
