// The guide: an interactive flow diagram that explains how to use this skill.
// It is also a complete example of a config. Build it with:
//   python3 scripts/build_standalone.py examples/guide.config.js guide.html --title "Interactive flow diagram"
var config = {
  ariaLabel: 'How the interactive flow diagram skill works',
  labels: { switchOff: 'Planned off', switchOn: 'Planned on' },
  groups: [
    { id: 'you', title: 'You', cols: [1],
      drawing: { viewBox: '60 0 330 300', stroke: 1.1, align: 'center',
        d: 'M73.6 51.6 L282.4 29.7 L306.4 258.4 L97.6 280.3 Z M285.5 59.5 L252.6 32.8 M252.6 32.8 L255.7 62.6 L285.5 59.5 M101.8 80.8 L249 65.3 M103.9 100.7 L225.2 88 M105.9 120.6 L245.2 106 M108 140.5 L197.5 131.1 M114 178.1 L165.7 172.6 L168.4 198.5 L116.7 203.9 Z M197.5 169.3 L249.3 163.9 L252 189.7 L200.3 195.1 Z M203 221 L254.7 215.6 L257.4 241.4 L205.7 246.9 Z M167.1 185.6 L196.9 182.4 M190.4 178.1 L197.9 182.3 L191.5 188 M226.1 192.4 L228.6 216.3 M223 210.9 L228.7 217.3 L233 209.8 M270.1 228 L290.6 210.2 L364.3 92.3 L368.5 79.6 L360.3 74.5 L350.7 83.9 L277.1 201.7 Z M290.6 210.2 L277.1 201.7 M353.7 109.3 L340.1 100.8 M283.9 206 L346.9 105.1 M276.3 222.5 L272.3 220' } },
    { id: 'skill', title: 'The skill', cols: [2, 3],
      drawing: { viewBox: '20 0 360 300', stroke: 1.1, align: 'bottom',
        d: 'M200 46 m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 M200 35 L200 14 M196 14 L204 14 L204 6 L196 6 Z M188.5 52.9 L121.3 204.8 L126.7 207.2 L197.5 57.1 Z M124 206 L118 232 M202.5 57.2 L275.3 197.3 L280.7 194.7 L211.5 52.8 Z M275 196 L286 226 L281 196M40 255 L360 255 L360 285 L40 285 Z M50 255 L50 267 M59.7 255 L59.7 261 M69.4 255 L69.4 261 M79.1 255 L79.1 261 M88.8 255 L88.8 261 M98.5 255 L98.5 267 M108.2 255 L108.2 261 M117.9 255 L117.9 261 M127.6 255 L127.6 261 M137.3 255 L137.3 261 M147 255 L147 267 M156.7 255 L156.7 261 M166.4 255 L166.4 261 M176.1 255 L176.1 261 M185.8 255 L185.8 261 M195.5 255 L195.5 267 M205.2 255 L205.2 261 M214.9 255 L214.9 261 M224.6 255 L224.6 261 M234.3 255 L234.3 261 M244 255 L244 267 M253.7 255 L253.7 261 M263.4 255 L263.4 261 M273.1 255 L273.1 261 M282.8 255 L282.8 261 M292.5 255 L292.5 267 M302.2 255 L302.2 261 M311.9 255 L311.9 261 M321.6 255 L321.6 261 M331.3 255 L331.3 261 M341 255 L341 267 M350.7 255 L350.7 261' } }
  ],
  nodes: [
    { id: 'describe', col: 1, row: 1, title: 'Describe your system', sub: 'parts and what flows between them',
      kind: 'Step 1 · you',
      text: ['Tell the assistant what your system is made of: the parts, what each one does, and what flows between them. Software, hardware or both.',
             'Say what already exists and what is only planned, and which parts belong together. Groups become columns with a header.'],
      list: ['the parts and their names (programs, files, devices, services)', 'who sends what to whom', 'groups, for example hardware and software', 'optional: one line drawing per group'] },

    { id: 'islands', col: 2, row: 2, title: 'Turns parts into islands', sub: 'title · subtitle · details',
      kind: 'Step 2 · the skill',
      text: ['Every part becomes an island with a short title and a subtitle. Chips can show files or settings it uses.',
             'The longer explanation goes into the details window that opens with More. Technical names can be shown in a monospace font.'],
      list: ['id, col, row', 'title, sub, chips, code', 'kind, text, list, status', 'planned: true'], listCode: true },

    { id: 'layout', col: 2, row: 3, title: 'Lays out the flow', sub: 'top to bottom, few crossings',
      kind: 'Step 2 · the skill',
      text: ['Rows run from top to bottom in the order things happen. The main strand gets a column of its own, side strands run beside it, and paths that return run back up along a lane.',
             'Steps that follow each other sit in neighbouring rows, so their connectors stay short and straight.'] },

    { id: 'connectors', col: 3, row: 3, title: 'Routes the connectors', sub: 'down · across · elbow · lane',
      kind: 'Feature',
      text: ['Connectors are routed automatically: straight down within a column, straight across within a row, as an elbow to a lower row in another column, and along a lane beside the columns when they go back up.',
             'Where two lines would still cross, one connector is sent along a different gutter or nudged by a few pixels. Request and answer can be drawn as a pair of arrows.'],
      list: ["via: 'left' | 'right' | gutter number", "enter: 'top', exit: 'bottom'", 'track: 0 to 1, dx, dy', "pair: true, label: '…'"], listCode: true },

    { id: 'motion', col: 2, row: 4, title: 'Adds focus and motion', sub: 'lift, More, travelling bulges',
      kind: 'Feature',
      text: ['Hovering an island lifts it, and small bulges travel along its connectors, growing towards the island in focus. A click, a tap or the keyboard pins the focus.',
             'More opens the details window; it stays open until Close, Escape or another island. All motion stops when the system asks for reduced motion.'] },

    { id: 'drawings', col: 3, row: 4, title: 'Background drawings', sub: 'one per group, optional',
      kind: 'Feature',
      text: ['Each group can bring a line drawing. It fades in slowly behind the diagram while one of the group’s islands is in focus, and crossfades when the focus moves to another group.',
             'Drawings are plain SVG paths in the config. A helper script crops a drawing, removes its background and makes the path compact.'],
      list: ['scripts/compact_svg.py drawing.svg'], listCode: true },

    { id: 'preview', col: 2, row: 5, title: 'Builds a preview', sub: 'one self-contained HTML file', chips: ['preview.html'],
      kind: 'Step 2 · the skill',
      text: ['The result is a single HTML file with the engine, the styles and your content inside. Where the app can show HTML, the assistant shows it straight away; otherwise you get the file to open in any browser.'] },

    { id: 'planned', col: 3, row: 5, planned: true, title: 'Planned parts', sub: 'dashed, behind the switch',
      kind: 'Feature',
      text: ['Islands marked as planned are drawn dashed. Connectors marked as planned only appear when the switch at the top right is on, so one diagram can show today and what comes next.',
             'This island is planned itself: switch on to see its connector.'] },

    { id: 'review', col: 1, row: 5, title: 'Explore the preview', sub: 'hover, click, switch, resize',
      kind: 'Step 3 · you',
      text: ['Try the diagram the way your readers will: hover, click, open More, flip the switch, make the window narrow.',
             'Ask for changes in plain words: move an island, rename it, add a part, change a drawing. The assistant updates the config and builds a new preview.'] },

    { id: 'embed', col: 1, row: 6, title: 'Put it on your page', sub: 'plain HTML, React, docs sites', chips: ['flow-map.js', 'flow-map.css'],
      kind: 'Step 4 · you',
      text: ['Copy the two engine files next to your page and call createFlowMap with an element and your config. It returns a function that removes the diagram again.',
             'Set --flow-bg to your page background so islands cover the drawings, and add data-theme="dark" or the class dark for dark mode.'],
      list: ['<div id="flow"></div>', 'createFlowMap(el, config)', 'React: call it in useEffect and return its result', 'docs sites: the same, inside a component'], listCode: true }
  ],
  edges: [
    { from: 'describe', to: 'islands' },
    { from: 'islands', to: 'layout' },
    { from: 'layout', to: 'connectors' },
    { from: 'layout', to: 'motion' },
    { from: 'motion', to: 'drawings' },
    { from: 'motion', to: 'preview' },
    { from: 'preview', to: 'review' },
    { from: 'review', to: 'islands', label: 'changes' },
    { from: 'review', to: 'embed' },
    { from: 'preview', to: 'planned', planned: true }
  ]
};
