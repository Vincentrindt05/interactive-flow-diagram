# Config reference

`createFlowMap(element, config)` builds the diagram inside `element` and returns a function that removes it again.

```js
var config = {
  ariaLabel: 'How orders move through the shop',          // name for screen readers
  labels: { switchOff: 'Planned off', switchOn: 'Planned on' },
  groups: [ ... ],
  nodes: [ ... ],
  edges: [ ... ],
  dividers: [ ... ]                                         // optional
};
```

## groups

A group is a set of neighbouring columns with a header. Each group may bring one background drawing.

| field | meaning |
|---|---|
| `id` | short name, used by nodes and drawings |
| `title` | header text above its columns (omit for no header row) |
| `cols` | columns of the group, e.g. `[1]` or `[2, 3]` |
| `drawing` | optional: `{ viewBox, d, stroke?, align?, inset? }` |

`drawing.d` is SVG path data. With `stroke: 1.2` it is drawn as lines of that width (viewBox units); without it, the shapes are filled (good for vectorised scans). `align` is `'center'` (default), `'bottom'` (stands on the bottom edge) or `'top'`. `inset` is a CSS inset such as `'4% 0'` for some air. `scripts/compact_svg.py` turns any SVG into this form.

## nodes (islands)

| field | meaning |
|---|---|
| `id` | unique name used by edges |
| `col`, `row` | position; columns start at 1 on the left, rows at 1 at the top |
| `title` | short name shown in bold (up to about 28 characters) |
| `sub` | one short line below the title (hidden on phones) |
| `chips` | small tags, e.g. config files: `['settings.yaml']` (hidden on phones) |
| `code` | `true` shows the title in a monospace font and keeps it from auto-translation |
| `planned` | `true` draws the island dashed and marks it as planned |
| `group` | group id, only needed when the column does not decide it |
| `kind` | small grey line at the top of the details window, e.g. `'Service · backend'` |
| `text` | details: one string or a list of paragraphs |
| `list` | details: bullet points; `listCode: true` shows them in monospace (paths, commands) |
| `status` | details: last line, separated by a rule, e.g. what is missing |

## edges (connectors)

| field | meaning |
|---|---|
| `from`, `to` | island ids |
| `planned` | `true`: dashed, and only shown while the switch is on |
| `label` | short text next to the connector |
| `pair` | `true`: two arrows, there and back (request and answer, command and feedback) |
| `via` | send it along a lane: `'left'`, `'right'` or a gutter number (see below) |
| `exit` | `'bottom'`: leave a lane connector from the bottom of the island instead of its side |
| `enter` | `'top'`: enter the target from the top instead of its side |
| `track` | position inside its gutter, 0 (left edge) to 1 (right edge) |
| `dx`, `dy` | nudge by a few pixels |

Automatic routes, when `via` is not set:

- same column, lower row: straight down
- same row: straight across
- lower row, other column: an elbow through the gap above the target's row
- higher row (going back up): along a lane; in the same column the lane runs on the left, otherwise in the gutter between the two columns

Gutters are numbered: `0` is left of column 1, `1` is between columns 1 and 2, and so on; the last one is right of the last column. Gutters widen automatically when several lanes run through them.

## dividers

`{ col, row, text }` draws a dashed rule with a small label across one column, for example to separate what happens before and after a hand-over.

## Theme

The styles read these CSS variables; set them on `.flow-map` or any ancestor:

| variable | default (light) | use |
|---|---|---|
| `--flow-bg` | `#fff` | page background; islands use it so drawings sit behind them |
| `--flow-surface` | `#fff` | lifted island and the More tag |
| `--flow-line` | `currentColor` | outlines, connectors, arrows |
| `--flow-muted` | `#606770` | subtitles, headers, labels |
| `--flow-soft` | `#dadde1` | header rule, chips, window border |
| `--flow-popup` | `#ebedf0` | details window |
| `--flow-on`, `--flow-off` | green, red | the switch |
| `--flow-drawing-opacity` | `0.18` | background drawings |

Dark mode: add `data-theme="dark"` or the class `dark` to any ancestor (most docs frameworks already do), or give the diagram element the class `flow-map--auto` to follow the system setting.

## Embedding

Plain HTML:

```html
<link rel="stylesheet" href="flow-map.css">
<div id="flow"></div>
<script src="flow-map.js"></script>
<script src="my-config.js"></script>   <!-- defines var config = {...} -->
<script>createFlowMap(document.getElementById('flow'), config);</script>
```

React, Next.js, Docusaurus and similar:

```jsx
import { useEffect, useRef } from 'react';
import createFlowMap from './flow-map.js';
import './flow-map.css';
import config from './my-config.js';   // export default { ... }

export default function FlowMap() {
  const ref = useRef(null);
  useEffect(() => createFlowMap(ref.current, config), []);   // returns the cleanup
  return <div ref={ref} />;
}
```

With Vite or another bundler that only understands ES modules, load the file for its side effect instead: `import './flow-map.js'` and then use `window.createFlowMap`.

The diagram measures its own width: below 640 px it switches to a compact look (smaller text, no subtitles or chips, the details window below the island).
