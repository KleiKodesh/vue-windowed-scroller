# vue-windowed-scroller

A Vue 3 list for very long, variable-height content - books, logs, search results -
that mounts only a sliding **window** of rows.

Unlike a virtualizer, rows are **real flow content**, not absolutely positioned
boxes at estimated offsets. So:

- **Jumps are exact.** `scrollToIndex(5000)` builds the window at row 5000 and sets the
  scroll from the row's measured position: one render, no drift, no settle loop.
- **The reader's place holds still.** Rows mounting above, a zoom, a font arriving, a
  width change re-wrapping text: the row (down to the very words) at the top of the
  viewport stays where it was.
- **Opening deep in the list is a normal open.** The start row is an argument
  (`initialIndex`), not a scroll after mounting at the top.
- **Rows are fetched before they mount.** Your `ensureRows(start, end)` resolves when
  the rows can be rendered; nothing is ever shown as a placeholder.
- **A difficult row source never leaves it stuck.** Slow, failing, never answering,
  still streaming in, shrinking: the list keeps growing as the reader pushes on, with
  one request per reader move at most - never a retry loop, never a timer.
- **The scrollbar is for the whole list,** not the mounted window: drawn beside the
  viewport like a native bar, with optional landmarks (chapter starts get enough track
  to point at) and per-row size weights for an accurate thumb.
- **Flow mode** runs rows on as paragraphs (a book's lines as running text) without
  ever re-wrapping what is on screen.

## Install

```sh
npm install vue-windowed-scroller
```

Peer dependencies: `vue` ^3.5 and `@vueuse/core` 10 to 13.

```ts
import 'vue-windowed-scroller/style.css'
```

## Use

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { WindowedScroller, type WindowedScrollerApi } from 'vue-windowed-scroller'

const lines = ref<string[]>([])            // filled by ensureRows
const scroller = ref<WindowedScrollerApi>()

async function ensureRows(start: number, end: number) {
  // Fetch [start, end) if not loaded yet; reject when it cannot be had.
}
</script>

<template>
  <div style="height: 100vh">
    <WindowedScroller ref="scroller" :count="100_000" :ensure-rows="ensureRows" :initial-index="2500">
      <template #row="{ index }">
        <p>{{ lines[index] }}</p>
      </template>
    </WindowedScroller>
  </div>
</template>
```

The scroller fills its parent's height. Attributes (`class`, `tabindex`, listeners)
go to the scrolling viewport element.

## Props

| Prop | Type | |
|---|---|---|
| `count` | `number` | Rows in the list. Required. |
| `ensureRows` | `(start, end) => Promise<void>` | Resolves once rows `[start, end)` can render; rejects when they cannot. Asked for rows that do not exist yet (a list still streaming), resolve when they do or when it is known they never will. Omit when rows are always available. |
| `initialIndex` | `number` | Row the first window is built at. Read once: re-key the component to open elsewhere. |
| `initialOffsetPx` | `number` | Pixels into the start row (a saved position). Read once. |
| `pinnedIndexes` | `number[]` | Rows kept mounted (out of flow) outside the window - e.g. the ends of a text selection. |
| `rowSourceVersion` | `unknown` | Change it when row content changes under the same indexes; the window is asked for again. |
| `landmarkTiers` | `number[][]` | Section starts, coarse to fine; each gets enough scrollbar track to point at. |
| `rowWeights` | `ArrayLike<number>` | A size weight per row (e.g. character count), `count` long: a static height estimate for the scrollbar. |
| `mode` | `'rows' \| 'flow'` | `flow` runs rows on as paragraphs between landmarks. Default `rows`. |
| `rowKind` | `(index) => 'block' \| 'inline'` | Flow mode: take a row out of its paragraph. |
| `paragraphClass` | `string` | Flow mode: class for the paragraph element. |
| `thin` | `boolean` | A thin scrollbar. |
| `endPaddingEm` | `number` | Space after the last row, in em. |

## Slots

- `row` `{ index, kind }` - one row's content. `kind` is `'inline'` for a row flowing in a paragraph (render inline content).
- `opening` - shown when a scroller created deep in its list waits a while for its start row.

## Events

- `opened` - the first window is on screen (once per scroller).
- `move(source)` - the view scrolled. `source` is `'reader'` or `'landing'` (a jump your code asked for).
- `moveend(source)` - the view stopped. Every move ends in exactly one `moveend`, including jumps that swapped rows without changing `scrollTop`.

## Methods (via template ref, `WindowedScrollerApi`)

`scrollToIndex(index, { offsetPx?, align? })` (resolves `true` when landed, `false` when superseded),
`revealIndex(index)` (nearest-edge, for keyboard highlight), `replaceRows(at, removed, inserted)`
(rows inserted/removed mid-list, e.g. a tree expanding, reader's row held still), `nudge(px)`,
`readFirstVisible()`, `isRowRendered(index)`, `isRowFullyVisible(index)`, `rowElement(index)`,
`isLanding()`, `renderedRange`, `scrollerElement`, `scrollbarElement`, `barTargetAt(clientY)`, `thumbRect()`.

## App-wide options

```ts
import { VueWindowedScroller } from 'vue-windowed-scroller'

app.use(VueWindowedScroller, {
  onBarHover: (viewport) => { /* e.g. reveal scrollbars hidden until used */ },
  barHoverRepeatMs: 400,           // onBarHover repeats while the pointer stays on the bar
  openingIndicator: MySpinner,     // replaces the built-in spinner
})
```

Rendering into a popup window that shares the page's script? Call
`provideScrollerHostWindow(popup)` in the component that renders there; scrollers below
it then listen, measure and observe in that window.

## Theming

The scrollbar thumb is `--windowed-scroller-color` (default: the text colour) at 30%,
45% on hover and 60% while pressed. Or set `--bar-thumb`, `--bar-thumb-hover` and
`--bar-thumb-active` directly. `--bar-glide-ms` sets the thumb's glide (default 220ms).

## Development

```sh
npm test            # unit tests
npm run test:e2e    # the real component in headless Chromium, against a slow / failing / hanging / shrinking row source
npm run build
```

## License

MIT
