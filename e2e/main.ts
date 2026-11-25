// The e2e page: the real component over a row source the test drives by hand.
import { createApp, h, ref } from 'vue'
import { WindowedScroller, type WindowedScrollerApi } from '../src/index'

type Mode = 'ok' | 'fail' | 'hang' | 'slow'
const count = ref(10_000)
const scroller = ref<WindowedScrollerApi>()
const held: (() => void)[] = []
const rig = {
  mode: 'ok' as Mode,
  requests: 0,
  /** Answers every request held in 'slow' mode. */
  release() { for (const resolve of held.splice(0)) resolve() },
  setCount(value: number) { count.value = value },
  scrollToIndex: (index: number) => scroller.value!.scrollToIndex(index),
}
;(window as unknown as { rig: typeof rig }).rig = rig

function ensureRows(): Promise<void> {
  rig.requests++
  if (rig.mode === 'fail') return Promise.reject(new Error('rows unavailable'))
  if (rig.mode === 'hang') return new Promise(() => {})
  if (rig.mode === 'slow') return new Promise((resolve) => { held.push(resolve) })
  return Promise.resolve()
}

createApp({
  render: () =>
    h(WindowedScroller, { ref: scroller, count: count.value, ensureRows, tabindex: 0, id: 'viewport' }, {
      row: ({ index }: { index: number }) => h('div', { style: `height:${24 + (index % 5) * 8}px` }, `row ${index}`),
    }),
}).mount('#app')
