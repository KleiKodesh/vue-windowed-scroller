import { ref, toValue, watch, onScopeDispose, type MaybeRefOrGetter } from 'vue'

type Target = MaybeRefOrGetter<Element | null | undefined>

/**
 * @internal A ResizeObserver built from the window the element is DRAWN in.
 *
 * VueUse's useResizeObserver / useElementSize always construct the page realm's global
 * `ResizeObserver` (their `window` option only gates support). When the scroller is drawn into
 * a popup of the page (see provideScrollerHostWindow), that observer reports the popup's
 * elements only while the page's own window is drawing frames - a hidden opener never does, so
 * sizes froze at their first value. The element's own window's observer always reports.
 */
export function useElementResizeObserver(target: Target, callback: ResizeObserverCallback): void {
  let observer: ResizeObserver | undefined
  const stopWatch = watch(
    () => toValue(target),
    (element) => {
      observer?.disconnect()
      observer = undefined
      const view = element?.ownerDocument.defaultView as (Window & typeof globalThis) | null | undefined
      if (!element || !view?.ResizeObserver) return
      observer = new view.ResizeObserver(callback)
      observer.observe(element)
    },
    { immediate: true, flush: 'post' },
  )
  onScopeDispose(() => {
    stopWatch()
    observer?.disconnect()
  })
}

/** @internal An element's content-box height, kept current by useElementResizeObserver. */
export function useElementHeight(target: Target) {
  const height = ref(0)
  watch(
    () => toValue(target),
    (element) => {
      height.value = element && 'offsetHeight' in element ? (element as HTMLElement).offsetHeight : 0 // as VueUse seeds it, until the first observation
    },
    { immediate: true, flush: 'post' },
  )
  useElementResizeObserver(target, ([entry]) => {
    if (entry) height.value = entry.contentRect.height
  })
  return height
}
