---
name: interactive-flow-diagram
description: Turn a described software or hardware process, pipeline or system architecture into an interactive top-down flow diagram for a web page - islands with hover focus and detail popovers, crossing-free connectors with animated flow, a switch for planned future parts, and optional background drawings. Use when the user wants an interactive or explorable diagram of how parts of a system connect, not a static image or a quick Mermaid chart.
---

# Interactive flow diagram

Builds an explorable flow diagram from a description of a system. The engine is ready-made (`assets/flow-map.js`, `assets/flow-map.css`, no dependencies); your job is the content: a config with islands, connectors and groups, laid out so the flow reads from top to bottom without crossings. `examples/guide.config.js` is a complete, working config; read it before writing your first one. Every option is in `references/config.md`.

## 1. Gather the content

From what the user gave you, collect:

- the parts (programs, services, files, devices, people) and what each one does
- what flows between them, and in which direction; which exchanges go both ways
- groups that belong together (for example hardware and software, or two teams): each group becomes one or more columns with a header
- what exists today and what is only planned
- optional: one line drawing per group for the background

If the description already covers this, start building. Otherwise ask once, briefly, for what is missing; a rough first diagram is often the best way to get the details right.

## 2. Write the config

Lay it out on a grid before writing it:

- **One main strand** gets its own column and runs from top to bottom in the order things happen. Side strands run in the next column, beside the step they branch from.
- **Rows are time.** Steps that follow each other sit in neighbouring rows of the same column, so their connector is a short straight line.
- **Paths back up** (feedback, results, "ask again") are allowed and run along a lane: within one column on its left, between two columns in the gutter between them.
- **At most four columns.** On phones every column gets about a quarter of the width.
- **Short text on the islands:** title up to about 28 characters, subtitle one short line. Everything else goes into the details (`kind`, `text`, `list`, `status`).
- **Technical names** (files, functions, topics): set `code: true` so they show in monospace and are not auto-translated.
- **Request and answer** between two islands: one edge with `pair: true` instead of two edges.
- **Planned parts:** `planned: true` on islands (dashed) and on connectors (dashed, only shown with the switch on). The switch appears by itself when at least one connector is planned.

## 3. Build the preview

Always produce one self-contained HTML file with engine, styles and config inside, so it opens anywhere.

- If you can run code: `python3 scripts/build_standalone.py my.config.js preview.html --title "…" --intro "…"`
- If you cannot: copy `assets/template.html` and replace `{{TITLE}}`, `{{INTRO}}`, `{{FOOTER}}` (may be empty), `{{CSS}}` (contents of `flow-map.css`), `{{JS}}` (contents of `flow-map.js`) and `{{CONFIG}}` (your `var config = {...};`).

Then show it the way your app allows: render the HTML inline or as a page preview if you can; otherwise hand over the file and say it opens in any browser.

## 4. Check it

Look at the rendered diagram (take a screenshot if you can), wide and at phone width (about 390 px), with the switch off and on:

- **Crossings and overlaps.** If two connectors cross, fix the layout first (move an island a row or column), then route: `via: 'left' | 'right' | <gutter number>`, `enter: 'top'`, `exit: 'bottom'`, `track: 0…1`, `dx`/`dy`. A typical case: an elbow that cuts through a lane; send it along the gutter with `via` instead.
- **Labels** must not sit under islands; shorten them or move the connector.
- **Details windows:** every island should say something useful when More is opened.
- **Drawings** stay faint and do not fight with the text.

Fix what you find before showing the result, then ask the user to try it: hover, click, More, the switch, a narrow window. Apply their changes to the config and rebuild.

## 5. Background drawings

One drawing per group, shown faintly while an island of that group is in focus. Convert any SVG with:

```
python3 scripts/compact_svg.py drawing.svg -o drawing.json
```

It drops white backgrounds, crops to the drawing and shrinks the path; put the JSON into the group's `drawing`. Line drawings get a `stroke` width; filled outlines (scans) do not. Without code execution, copy the path data by hand and set `viewBox` tightly around the drawing. Never use drawings of real logos, characters or products unless the user made them or owns them.

## 6. Hand it over

Give the user the preview file and, if it goes onto their site, the two engine files plus their config, with the matching snippet from `references/config.md` (plain HTML or a React component). Mention the theme variables (`--flow-bg` must match their page background) and how dark mode is switched on.
