/**
 * What the host app can tell every WindowedScroller - set once, never per instance.
 *
 *   app.use(VueWindowedScroller, { onBarHover, openingIndicator })   // app-wide
 *   provideScrollerHostWindow(popupWindow)                            // per subtree
 */
import { hasInjectionContext, inject, provide, type App, type Component, type InjectionKey } from 'vue'

export type ScrollerHostWindow = Window & typeof globalThis

export interface WindowedScrollerOptions {
  /**
   * Called when the pointer enters the scrollbar, and every `barHoverRepeatMs` while it
   * stays: for an app that hides its scrollbars until used and shows them on hover.
   * Receives the scroller's viewport (the element the scrollbar belongs to).
   */
  onBarHover?: (viewport: HTMLElement) => void
  /** How often `onBarHover` repeats while the pointer stays on the bar. Default 400 ms. */
  barHoverRepeatMs?: number
  /**
   * Shown over a scroller created deep in its list while its start row is still on its
   * way (only after a short delay, so a normal open never flashes it). Default: a small
   * built-in spinner. A scroller's own `opening` slot overrides it.
   */
  openingIndicator?: Component
}

const OPTIONS: InjectionKey<WindowedScrollerOptions> = Symbol('windowedScrollerOptions')
const HOST_WINDOW: InjectionKey<ScrollerHostWindow> = Symbol('windowedScrollerHostWindow')

/** Vue plugin: `app.use(VueWindowedScroller, options)`. Optional - every option has a default. */
export const VueWindowedScroller = {
  install(app: App, options: WindowedScrollerOptions = {}) {
    app.provide(OPTIONS, options)
  },
}

/**
 * Everything rendered below the caller lives in `hostWindow` - a popup that shares the
 * page's script but has its own `window` and `document`. The scroller then listens,
 * measures and observes in that window instead of the global one.
 */
export function provideScrollerHostWindow(hostWindow: ScrollerHostWindow): void {
  provide(HOST_WINDOW, hostWindow)
}

/** @internal The window this scroller is rendered in. Call during setup. */
export function useScrollerHostWindow(): ScrollerHostWindow {
  return hasInjectionContext() ? inject(HOST_WINDOW, window) : window
}

/** @internal The app-wide options. Call during setup. */
export function useScrollerOptions(): WindowedScrollerOptions {
  return hasInjectionContext() ? inject(OPTIONS, {}) : {}
}
