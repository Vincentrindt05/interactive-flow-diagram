/*
 * flow-map.js: interactive top-down flow diagram.
 *
 *   var destroy = createFlowMap(element, config);
 *
 * Islands sit on a grid (col, row). Connectors are routed automatically:
 *   same column, lower row      -> straight down
 *   same row                    -> straight across
 *   lower row, other column     -> elbow through the gap above the target row
 *   higher row (going back up)  -> along a lane in the gutter beside the columns
 * Any connector can be sent along a lane with `via: 'left' | 'right'`.
 * See references/config.md for every option.
 *
 * Works as a classic <script> (sets window.createFlowMap) and as a CommonJS/bundler import.
 */
(function (global) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  // bulges that travel along the connectors of the island in focus
  var FLOW = {
    gap: 64,        // px between bulges
    speed: 36,      // px per second
    len: 22,        // px length of a fully grown bulge
    width: 4,       // px from the line to the edge of a fully grown bulge
    peak: 0.4,      // where along the connector the bulge is largest, measured from the island in focus
    fullLen: 260,   // connectors at least this long get full-size bulges
    minAmp: 0.3,    // smallest bulge size, for the shortest connectors
    end: 6          // px before the end where the bulge has flattened (keeps clear of the arrowhead)
  };
  var PORT = 14;          // px between connectors that meet the same side of an island
  var PORT_V = 16;        // px between connectors that meet the top or bottom of an island
  var RADIUS = 6;         // corner radius of connectors
  var NARROW = 640;       // below this width the diagram switches to its compact look
  var LEAVE_DELAY = 220;  // ms the focus waits after the pointer leaves, so it can reach the "More" tag
  var DRAWING_HOLD = 700; // ms a background drawing stays after the focus is gone

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svgEl(tag, cls) {
    var e = document.createElementNS(SVG_NS, tag);
    if (cls) e.setAttribute('class', cls);
    return e;
  }
  function noTranslate(e) { e.setAttribute('translate', 'no'); return e; }
  function ease(x) { return x * x * (3 - 2 * x); }
  function sign(v) { return v < 0 ? -1 : v > 0 ? 1 : 0; }
  function px(list) { return list.split(' ').map(parseFloat).filter(function (v) { return !isNaN(v); }); }

  function createFlowMap(root, config) {
    config = config || {};
    var groups = config.groups || [];
    var labels = config.labels || {};
    var NODES = config.nodes || [];
    var EDGES = config.edges || [];
    var hasHeads = groups.some(function (g) { return g.title; });
    var rowOffset = hasHeads ? 1 : 0;
    var colCount = NODES.reduce(function (m, n) { return Math.max(m, n.col); }, 1);
    groups.forEach(function (g) { (g.cols || []).forEach(function (c) { colCount = Math.max(colCount, c); }); });
    var hasPlannedEdges = EDGES.some(function (e) { return e.planned; });
    var showSwitch = config.switch === true || (config.switch !== false && hasPlannedEdges);
    var uid = 'flow-map-' + Math.random().toString(36).slice(2, 8);

    root.classList.add('flow-map');
    root.setAttribute('role', 'group');
    if (config.ariaLabel) root.setAttribute('aria-label', config.ariaLabel);

    // ---- switch for planned connectors ----
    var toggle = null, toggleLabel = null;
    if (showSwitch) {
      var bar = el('div', 'flow-map__bar');
      toggle = el('button', 'flow-map__switch');
      toggle.type = 'button';
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-checked', 'false');
      toggleLabel = el('span', 'flow-map__switch-label', labels.switchOff || 'Planned off');
      toggle.appendChild(toggleLabel);
      var track = el('span', 'flow-map__switch-track');
      track.setAttribute('aria-hidden', 'true');
      track.appendChild(el('span', 'flow-map__switch-knob'));
      toggle.appendChild(track);
      bar.appendChild(toggle);
      root.appendChild(bar);
    }

    var grid = el('div', 'flow-map__grid');
    root.appendChild(grid);

    // ---- background drawings, one per group ----
    var backdrop = el('div', 'flow-map__backdrop');
    backdrop.setAttribute('aria-hidden', 'true');
    var drawings = {};
    groups.forEach(function (g) {
      if (!g.drawing) return;
      var sk = svgEl('svg', 'flow-map__drawing');
      sk.setAttribute('viewBox', g.drawing.viewBox);
      var align = g.drawing.align || 'center';
      sk.setAttribute('preserveAspectRatio', 'xMidY' + (align === 'bottom' ? 'Max' : align === 'top' ? 'Min' : 'Mid') + ' meet');
      if (g.drawing.inset) sk.style.inset = g.drawing.inset;
      var p = svgEl('path');
      if (g.drawing.stroke) {   // line drawing: drawn with strokes of this width (in viewBox units)
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', 'currentColor');
        p.setAttribute('stroke-width', g.drawing.stroke);
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
      } else {                  // filled outlines, e.g. a vectorised scan
        p.setAttribute('fill', 'currentColor');
        p.setAttribute('fill-rule', 'evenodd');
      }
      p.setAttribute('d', g.drawing.d);
      sk.appendChild(p);
      backdrop.appendChild(sk);
      drawings[g.id] = sk;
    });
    grid.appendChild(backdrop);

    var svg = svgEl('svg', 'flow-map__edges');
    svg.setAttribute('aria-hidden', 'true');
    grid.appendChild(svg);

    // ---- headers and dividers ----
    groups.forEach(function (g) {
      if (!g.title || !g.cols || !g.cols.length) return;
      var h = el('div', 'flow-map__head', g.title);
      var lo = Math.min.apply(null, g.cols), hi = Math.max.apply(null, g.cols);
      h.style.gridColumn = (2 * lo) + ' / ' + (2 * hi + 1);
      h.style.gridRow = '1';
      grid.appendChild(h);
    });
    (config.dividers || []).forEach(function (d) {
      var dv = el('div', 'flow-map__divider', d.text || '');
      dv.style.gridColumn = String(2 * d.col);
      dv.style.gridRow = String(d.row + rowOffset);
      grid.appendChild(dv);
    });

    // ---- islands ----
    var popup = el('div', 'flow-map__popup');
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', labels.details || 'Details');
    popup.id = uid + '-popup';
    popup.hidden = true;

    function groupOf(n) {
      if (n.group) return n.group;
      for (var i = 0; i < groups.length; i++) if ((groups[i].cols || []).indexOf(n.col) >= 0) return groups[i].id;
      return null;
    }

    var nodes = {};
    NODES.forEach(function (n) {
      var cls = 'flow-map__node' + (n.planned ? ' is-planned' : '') + (n.code ? ' is-code' : '');
      var b = el('button', cls);
      b.type = 'button';
      b.style.gridRow = String(n.row + rowOffset);
      b.style.gridColumn = String(2 * n.col);
      var t = el('span', 'flow-map__title');
      // long technical names may break after _ / . on narrow screens
      String(n.title).split(/(?<=[_\/.])/).forEach(function (part, i) {
        if (i) t.appendChild(document.createElement('wbr'));
        t.appendChild(document.createTextNode(part));
      });
      if (n.code) noTranslate(t);
      b.appendChild(t);
      if (n.sub) b.appendChild(el('span', 'flow-map__sub', n.sub));
      if (n.chips && n.chips.length) {
        var f = el('span', 'flow-map__chips');
        n.chips.forEach(function (c) { f.appendChild(noTranslate(el('span', 'flow-map__chip', c))); });
        b.appendChild(f);
      }
      b.setAttribute('aria-describedby', popup.id);
      grid.appendChild(b);
      nodes[n.id] = { data: n, el: b, group: groupOf(n) };
    });
    grid.appendChild(popup);
    var pill = el('button', 'flow-map__more', labels.more || 'More');
    pill.type = 'button';
    pill.hidden = true;
    grid.appendChild(pill);

    EDGES.forEach(function (e) {
      if (!nodes[e.from] || !nodes[e.to]) throw new Error('flow-map: unknown island in edge ' + e.from + ' -> ' + e.to);
    });

    // ---- route plan (independent of the current size) ----
    // kind: down | across | elbow | lane. Lanes run in gutter g (0 = left of column 1, colCount = right of the last).
    // islands connected both ways at a diagonal: both connectors run as nested lanes in one gutter,
    // because an elbow there and a lane back would cross
    function hasReturn(e) {
      return EDGES.some(function (o) { return o !== e && o.from === e.to && o.to === e.from && !o.via; });
    }
    function plan(e) {
      var a = nodes[e.from].data, b = nodes[e.to].data, r = { e: e, a: a, b: b };
      if (!e.via && a.col === b.col && b.row > a.row) r.kind = 'down';
      else if (!e.via && a.row === b.row && a.col !== b.col) r.kind = 'across';
      else if (!e.via && b.row > a.row && !hasReturn(e)) r.kind = 'elbow';
      else {
        r.kind = 'lane';
        var via = e.via;
        if (!via) via = a.col === b.col ? 'left' : b.col < a.col ? 'between-left' : 'between-right';
        if (typeof via === 'number') {   // a specific gutter: 0 = left of column 1, n = right of column n
          r.g = via; r.aSide = a.col > via ? 'left' : 'right'; r.bSide = b.col > via ? 'left' : 'right';
        } else if (via === 'left') { r.g = Math.min(a.col, b.col) - 1; r.aSide = 'left'; r.bSide = 'left'; }
        else if (via === 'right') { r.g = Math.max(a.col, b.col); r.aSide = 'right'; r.bSide = 'right'; }
        else if (via === 'between-left') { r.g = b.col; r.aSide = 'left'; r.bSide = 'right'; }       // target is left of source
        else { r.g = b.col - 1; r.aSide = 'right'; r.bSide = 'left'; }                                 // target is right of source
        if (e.exit === 'bottom') r.aSide = 'bottom';
        if (e.enter === 'top') r.bSide = 'top';
      }
      return r;
    }
    var plans = EDGES.map(plan);
    var laneCount = [];
    for (var gi = 0; gi <= colCount; gi++) laneCount.push(0);
    plans.forEach(function (p) { if (p.kind === 'lane') laneCount[p.g]++; });

    // a labelled connector straight across a gutter needs room for its label
    var labelRoom = laneCount.map(function () { return 0; });
    plans.forEach(function (p) {
      if (p.kind === 'across' && p.e.label && Math.abs(p.a.col - p.b.col) === 1) {
        var g = Math.min(p.a.col, p.b.col);
        labelRoom[g] = Math.max(labelRoom[g], p.e.label.length * 6.5 + 20);
      }
    });
    function gridTemplate(narrow) {
      var cols = [];
      var gap = narrow ? 12 : 28, step = narrow ? 8 : 12;
      for (var g = 0; g <= colCount; g++) {
        var n = laneCount[g], outer = g === 0 || g === colCount;
        var w = n ? Math.max(outer ? 0 : gap, step * (n + 1)) : (outer ? 0 : gap);
        w = Math.max(w, labelRoom[g] * (narrow ? 0.85 : 1));
        cols.push(w + 'px');
        if (g < colCount) cols.push('minmax(0, 1fr)');
      }
      return cols.join(' ');
    }

    // ---- bulges ----
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var edgePaths = [], flowGroup = null, flowFrame = 0;
    function stopFlow() {
      if (flowFrame) cancelAnimationFrame(flowFrame);
      flowFrame = 0;
      if (flowGroup && flowGroup.parentNode) flowGroup.parentNode.removeChild(flowGroup);
      flowGroup = null;
    }
    function startFlow(id) {
      stopFlow();
      if (reduceMotion) return;
      var items = [];
      edgePaths.forEach(function (ep) {
        if (ep.from !== id && ep.to !== id) return;
        var peak = ep.to === id ? 1 - FLOW.peak : FLOW.peak;   // largest a little closer to the island in focus
        ep.paths.forEach(function (pth) {
          var len = pth.getTotalLength();
          if (len < 4) return;
          var n = Math.max(1, Math.round(len / FLOW.gap)), bulges = [];
          for (var i = 0; i < n; i++) bulges.push(svgEl('path', 'flow-map__flow'));
          items.push({ path: pth, len: len, peak: peak, amp: Math.max(FLOW.minAmp, Math.min(1, len / FLOW.fullLen)), bulges: bulges });
        });
      });
      if (!items.length) return;
      flowGroup = svgEl('g');
      items.forEach(function (it) { it.bulges.forEach(function (h) { flowGroup.appendChild(h); }); });
      svg.appendChild(flowGroup);
      function size(it, d) {
        var end = it.len - FLOW.end;
        if (d <= 0 || d >= end) return 0;
        var pk = it.peak * end;
        return ease(d < pk ? d / pk : (end - d) / (end - pk));
      }
      // outline that follows the path, so both tips stay on the line, also around corners
      function outline(it, d, sc) {
        var L = FLOW.len * (0.6 + 0.4 * sc), w = FLOW.width * sc, K = 12, left = [], right = [];
        for (var k = 0; k <= K; k++) {
          var t = k / K, at = Math.max(0, Math.min(it.len, d - L / 2 + t * L));
          var p0 = it.path.getPointAtLength(Math.max(0, at - 0.5)), p1 = it.path.getPointAtLength(Math.min(it.len, at + 0.5));
          var pt = it.path.getPointAtLength(at);
          var dx = p1.x - p0.x, dy = p1.y - p0.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
          var rr = w * Math.pow(Math.sin(Math.PI * t), 1.5);
          left.push((pt.x + nx * rr).toFixed(2) + ' ' + (pt.y + ny * rr).toFixed(2));
          right.unshift((pt.x - nx * rr).toFixed(2) + ' ' + (pt.y - ny * rr).toFixed(2));
        }
        return 'M' + left.join(' L') + ' L' + right.join(' L') + ' z';
      }
      var t0 = performance.now();
      function frame(now) {
        var travelled = (now - t0) / 1000 * FLOW.speed;
        items.forEach(function (it) {
          var n = it.bulges.length;
          it.bulges.forEach(function (h, i) {
            var d = (travelled + i * it.len / n) % it.len, sc = size(it, d) * it.amp;
            h.setAttribute('d', sc < 0.02 ? '' : outline(it, d, sc));
          });
        });
        flowFrame = requestAnimationFrame(frame);
      }
      flowFrame = requestAnimationFrame(frame);
    }

    // ---- background drawing of the group in focus ----
    var drawingTimer = 0;
    function showDrawing(id) {
      clearTimeout(drawingTimer);
      var g = nodes[id].group;
      Object.keys(drawings).forEach(function (k) { drawings[k].classList.toggle('is-shown', k === g); });
    }
    function hideDrawingSoon() {
      clearTimeout(drawingTimer);
      drawingTimer = setTimeout(function () {
        Object.keys(drawings).forEach(function (k) { drawings[k].classList.remove('is-shown'); });
      }, DRAWING_HOLD);
    }

    // ---- focus and info window ----
    // Hover moves the focus; click, tap or keyboard pins it. "More" opens the window, which stays
    // open until "Close" is pressed or another island is chosen.
    var current = null, pinnedId = null, leaveTimer = 0;
    function fillPopup(n) {
      var d = n.data;
      popup.innerHTML = '';
      var h = el('h4', null, d.title);
      if (d.code) noTranslate(h);
      popup.appendChild(h);
      var kind = [d.planned ? (labels.planned || 'Planned') : null, d.kind].filter(Boolean).join(' · ');
      if (kind) popup.appendChild(el('p', 'flow-map__kind', kind));
      [].concat(d.text || []).forEach(function (t) { popup.appendChild(el('p', null, t)); });
      if (d.list && d.list.length) {
        var ul = el('ul', 'flow-map__list' + (d.listCode ? ' is-code' : ''));
        if (d.listCode) noTranslate(ul);
        d.list.forEach(function (t) { ul.appendChild(el('li', null, t)); });
        popup.appendChild(ul);
      }
      if (d.status) popup.appendChild(el('p', 'flow-map__status', (labels.status || 'Status') + ': ' + d.status));
    }
    function show(id, withPopup) {
      clearTimeout(leaveTimer);
      if (current !== id) {
        current = id;
        Object.keys(nodes).forEach(function (k) { nodes[k].el.classList.toggle('is-open', k === id); });
        fillPopup(nodes[id]);
        startFlow(id);
        showDrawing(id);
      }
      popup.hidden = !withPopup;
      if (withPopup) place(nodes[id]);
      updatePill();
    }
    function updatePill() {
      if (!current) { pill.hidden = true; return; }
      var open = !popup.hidden;
      pill.textContent = open ? (labels.close || 'Close') : (labels.more || 'More');
      pill.setAttribute('aria-expanded', String(open));
      pill.setAttribute('aria-controls', popup.id);
      pill.setAttribute('aria-label', (open ? 'Close details of ' : 'Show details of ') + nodes[current].data.title);
      pill.hidden = false;
      // layout box plus the lift by hand, so the tag does not lag behind the lift animation
      var n = nodes[current].el, w = n.offsetWidth, h = n.offsetHeight, k = 1.025;
      var right = n.offsetLeft + w / 2 + w / 2 * k, top = n.offsetTop + h / 2 - h / 2 * k;
      pill.style.left = (right - pill.offsetWidth - 10) + 'px';
      pill.style.top = (top - pill.offsetHeight / 2) + 'px';
    }
    function pin(id, withPopup) { pinnedId = id; show(id, !!withPopup); }
    function hidePopup() { clearTimeout(leaveTimer); pinnedId = current; popup.hidden = true; updatePill(); }
    function close() {
      clearTimeout(leaveTimer);
      current = null; pinnedId = null;
      stopFlow();
      hideDrawingSoon();
      popup.hidden = true;
      pill.hidden = true;
      Object.keys(nodes).forEach(function (k) { nodes[k].el.classList.remove('is-open'); });
    }
    function leaveSoon() {
      clearTimeout(leaveTimer);
      if (current && current === pinnedId) return;
      leaveTimer = setTimeout(close, LEAVE_DELAY);
    }
    function place(n) {
      var r = grid.getBoundingClientRect(), b = n.el.getBoundingClientRect();
      var bl = b.left - r.left, br = b.right - r.left, top, left, width;
      if (r.width < NARROW) { width = r.width; left = 0; top = b.bottom - r.top + 8; }
      else {
        width = Math.min(340, r.width);
        if (br + 12 + width <= r.width) left = br + 12;
        else if (bl - 12 - width >= 0) left = bl - 12 - width;
        else left = Math.max(0, r.width - width);
        top = b.top - r.top;
      }
      popup.style.left = left + 'px';
      popup.style.width = width + 'px';
      popup.style.top = '0px';
      popup.style.top = Math.max(0, Math.min(top, r.height - popup.offsetHeight)) + 'px';
    }
    Object.keys(nodes).forEach(function (id) {
      var b = nodes[id].el;
      b.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch') return;
        clearTimeout(leaveTimer);
        if (current === id) return;
        pinnedId = null;
        show(id, false);
      });
      b.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') leaveSoon(); });
      b.addEventListener('focus', function () { if (pinnedId !== id) pin(id, false); });
      b.addEventListener('click', function () { if (pinnedId !== id || current !== id) pin(id, false); });
    });
    popup.addEventListener('pointerenter', function () { clearTimeout(leaveTimer); });
    popup.addEventListener('pointerleave', leaveSoon);
    pill.addEventListener('pointerenter', function () { clearTimeout(leaveTimer); });
    pill.addEventListener('pointerleave', leaveSoon);
    pill.addEventListener('click', function () {
      if (!current) return;
      if (popup.hidden) pin(current, true); else hidePopup();
    });
    function onKey(e) { if (e.key === 'Escape' && current) close(); }
    function onPointerDown(e) {
      if (!current || current === pinnedId) return;
      if (e.target.closest && e.target.closest('.flow-map__node')) return;
      if (popup.contains(e.target) || e.target === pill) return;
      close();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    if (toggle) {
      toggle.addEventListener('click', function () {
        var on = !root.classList.contains('is-planned-on');
        root.classList.toggle('is-planned-on', on);
        toggle.setAttribute('aria-checked', String(on));
        toggleLabel.textContent = on ? (labels.switchOn || 'Planned on') : (labels.switchOff || 'Planned off');
        close();
        draw();
      });
    }

    // ---- drawing the connectors ----
    function draw() {
      var narrow = root.getBoundingClientRect().width < NARROW;
      root.classList.toggle('is-narrow', narrow);
      grid.style.gridTemplateColumns = gridTemplate(narrow);
      var r = grid.getBoundingClientRect();
      var cs = getComputedStyle(grid);
      var colW = px(cs.gridTemplateColumns), rowH = px(cs.gridTemplateRows);
      var rowGap = parseFloat(cs.rowGap) || 0;
      var plannedOn = root.classList.contains('is-planned-on');
      stopFlow();
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      edgePaths = [];

      // x range of gutter g, y of the gap above grid row gr
      var colX = [0];
      colW.forEach(function (w, i) { colX.push(colX[i] + w); });
      function gutter(g) { return { l: colX[2 * g], r: colX[2 * g + 1] }; }
      var rowY = [0];
      rowH.forEach(function (h, i) { rowY.push(rowY[i] + h + (i < rowH.length - 1 ? rowGap : 0)); });
      function gapAbove(row) {   // row: content row (1-based)
        var gr = row + rowOffset - 1;   // 0-based grid row index
        if (gr <= 0) return rowY[0] - 8;
        return rowY[gr] - rowGap / 2;
      }
      function gapBelow(row) { return gapAbove(row + 1); }

      function box(id) {
        var b = nodes[id].el.getBoundingClientRect();
        return { l: b.left - r.left, r: b.right - r.left, t: b.top - r.top, b: b.bottom - r.top,
                 w: b.width, h: b.height, cx: (b.left + b.right) / 2 - r.left, cy: (b.top + b.bottom) / 2 - r.top };
      }
      var boxes = {};
      Object.keys(nodes).forEach(function (id) { boxes[id] = box(id); });

      var visible = plans.filter(function (p) { return !p.e.planned || plannedOn; });

      // lanes: tracks inside each gutter, shortest connectors nearest the islands they attach to
      var byGutter = {};
      visible.forEach(function (p) {
        if (p.kind !== 'lane') return;
        (byGutter[p.g] = byGutter[p.g] || []).push(p);
      });
      Object.keys(byGutter).forEach(function (g) {
        var list = byGutter[g], gt = gutter(+g);
        var maxSpan = Math.max.apply(null, list.map(function (p) { return Math.abs(boxes[p.e.from].cy - boxes[p.e.to].cy) || 1; }));
        list.forEach(function (p) {
          var span = Math.abs(boxes[p.e.from].cy - boxes[p.e.to].cy), norm = span / maxSpan;
          // loops (both ends on one side) run nearest that side, the shortest innermost;
          // connectors from the other side follow, the one reaching farthest nearest its target
          var aR = p.a.col > +g, bR = p.b.col > +g;   // attaches to the column right of the gutter
          p.key = aR && bR ? 1 - 0.25 * norm : !aR && !bR ? 0.25 * norm : bR ? 0.5 + 0.25 * norm : 0.5 - 0.25 * norm;
        });
        list.sort(function (x, y) { return x.key - y.key; });
        list.forEach(function (p, i) {
          var f = p.e.track != null ? p.e.track : (i + 1) / (list.length + 1);
          p.x = Math.round(gt.l + (gt.r - gt.l) * f) + 0.5;
        });
      });

      // ports: where connectors meet the sides of an island
      var ports = {};   // id -> side -> [request]
      function req(id, side, p, end, opts) {
        var s = (ports[id] = ports[id] || {});
        (s[side] = s[side] || []).push(Object.assign({ p: p, end: end }, opts));
      }
      visible.forEach(function (p) {
        var A = boxes[p.e.from], B = boxes[p.e.to];
        if (p.kind === 'down') {
          req(p.e.from, 'bottom', p, 'a', { fixed: true, pair: p.e.pair });
          req(p.e.to, 'top', p, 'b', { fixed: true, pair: p.e.pair });
        } else if (p.kind === 'across') {
          var right = B.cx > A.cx;
          req(p.e.from, right ? 'right' : 'left', p, 'a', { fixed: true, pair: p.e.pair });
          req(p.e.to, right ? 'left' : 'right', p, 'b', { fixed: true, pair: p.e.pair });
        } else if (p.kind === 'elbow') {
          req(p.e.from, 'bottom', p, 'a', { s: sign(B.cx - A.cx), ext: gapAbove(p.b.row) - A.b });
          req(p.e.to, 'top', p, 'b', { s: sign(A.cx - B.cx), ext: gapAbove(p.b.row) - A.b });
        } else {
          var yA = A.cy, yB = B.cy;
          if (p.aSide === 'bottom') req(p.e.from, 'bottom', p, 'a', { s: sign(p.x - A.cx), ext: Math.abs(p.x - A.cx) });
          else req(p.e.from, p.aSide, p, 'a', { s: sign(yB - yA), ext: Math.abs(p.x - (p.aSide === 'left' ? A.l : A.r)) });
          if (p.bSide === 'top') req(p.e.to, 'top', p, 'b', { s: sign(p.x - B.cx), ext: Math.abs(p.x - B.cx) });
          else req(p.e.to, p.bSide, p, 'b', { s: sign(yA - yB), ext: Math.abs(p.x - (p.bSide === 'left' ? B.l : B.r)) });
        }
      });
      // fixed ports sit around the centre; the others go to the side where their connector continues,
      // the one that reaches farthest closest to the centre, so nested connectors never cross
      function allocate(list, step) {
        var fixed = list.filter(function (q) { return q.fixed; });
        var lines = fixed.reduce(function (n, q) { return n + (q.pair ? 2 : 1); }, 0);
        var o = -(lines - 1) * step / 2;
        fixed.forEach(function (q) {
          if (q.pair) { q.offs = [o, o + step]; o += 2 * step; } else { q.offs = [o]; o += step; }
          q.off = q.offs.reduce(function (s, v) { return s + v; }, 0) / q.offs.length;
        });
        var free = list.filter(function (q) { return !q.fixed; });
        var both = free.some(function (q) { return q.s < 0; }) && free.some(function (q) { return q.s >= 0; });
        [-1, 1].forEach(function (s) {
          var side = free.filter(function (q) { return (q.s < 0 ? -1 : 1) === s; });
          side.sort(function (x, y) { return y.ext - x.ext; });
          var start = lines ? (lines - 1) * step / 2 + step : both ? step / 2 : 0;
          side.forEach(function (q, i) { q.off = s * (start + step * i); });
        });
      }
      Object.keys(ports).forEach(function (id) {
        var sides = ports[id];
        Object.keys(sides).forEach(function (side) {
          allocate(sides[side], side === 'top' || side === 'bottom' ? PORT_V : PORT);
        });
      });
      function portOf(p, end) {
        var id = end === 'a' ? p.e.from : p.e.to, sides = ports[id] || {}, found = null;
        Object.keys(sides).forEach(function (side) {
          sides[side].forEach(function (q) { if (q.p === p && q.end === end) found = q; });
        });
        return found;
      }

      function s(v) { return Math.round(v) + 0.5; }   // crisp 1 px lines
      var collect = null;
      function path(d, planned) {
        var p = svgEl('path', planned ? 'is-planned' : null);
        p.setAttribute('d', d);
        svg.appendChild(p);
        if (collect) collect.push(p);
      }
      function arrow(x, y, dir) {
        var a = 6, w = 3.5, d;
        if (dir === 'down') d = 'M' + x + ' ' + y + ' l' + (-w) + ' ' + (-a) + ' h' + 2 * w + ' z';
        if (dir === 'up') d = 'M' + x + ' ' + y + ' l' + (-w) + ' ' + a + ' h' + 2 * w + ' z';
        if (dir === 'left') d = 'M' + x + ' ' + y + ' l' + a + ' ' + (-w) + ' v' + 2 * w + ' z';
        if (dir === 'right') d = 'M' + x + ' ' + y + ' l' + (-a) + ' ' + (-w) + ' v' + 2 * w + ' z';
        var p = svgEl('path', 'flow-map__arrow');
        p.setAttribute('d', d);
        svg.appendChild(p);
      }
      function poly(pts, planned) {
        var d = 'M' + pts[0][0] + ' ' + pts[0][1];
        for (var i = 1; i < pts.length - 1; i++) {
          var p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
          var r1 = Math.min(RADIUS, Math.abs(p1[0] - p0[0]) / 2 + Math.abs(p1[1] - p0[1]) / 2);
          var r2 = Math.min(RADIUS, Math.abs(p2[0] - p1[0]) / 2 + Math.abs(p2[1] - p1[1]) / 2);
          var rr = Math.min(r1, r2);
          var ax = p1[0] - sign(p1[0] - p0[0]) * rr, ay = p1[1] - sign(p1[1] - p0[1]) * rr;
          var bx = p1[0] + sign(p2[0] - p1[0]) * rr, by = p1[1] + sign(p2[1] - p1[1]) * rr;
          d += ' L' + ax + ' ' + ay + ' Q' + p1[0] + ' ' + p1[1] + ' ' + bx + ' ' + by;
        }
        var last = pts[pts.length - 1];
        path(d + ' L' + last[0] + ' ' + last[1], planned);
        // the label goes above the longest horizontal stretch, or along the longest vertical one
        // when no horizontal stretch has room for it
        var best = null, vert = null;
        for (var j = 1; j < pts.length; j++) {
          var hl = Math.abs(pts[j][0] - pts[j - 1][0]), vl = Math.abs(pts[j][1] - pts[j - 1][1]);
          if (pts[j][1] === pts[j - 1][1] && (!best || hl > best.len)) best = { len: hl, x: (pts[j][0] + pts[j - 1][0]) / 2, y: pts[j][1] };
          if (pts[j][0] === pts[j - 1][0] && (!vert || vl > vert.len)) vert = { len: vl, x: pts[j][0], y: (pts[j][1] + pts[j - 1][1]) / 2, vertical: true };
        }
        return { h: best, v: vert };
      }
      function label(text, spot) {
        if (!text || !spot) return;
        var t = svgEl('text');
        t.setAttribute('text-anchor', 'middle');
        t.textContent = text;
        svg.appendChild(t);
        var room = text.length * 7 + 16;
        var h = spot.h, v = spot.v;
        if (h && (h.len >= room || !v || v.len < room)) {
          t.setAttribute('x', h.x);
          t.setAttribute('y', h.y - 9);   // clear of the bulges running along the line
        } else if (v) {
          t.setAttribute('x', v.x);
          t.setAttribute('y', v.y);
          t.setAttribute('transform', 'rotate(-90 ' + v.x + ' ' + v.y + ') translate(0 -8)');
        }
      }
      function sideX(B, side) { return side === 'left' ? B.l : B.r; }

      visible.forEach(function (p) {
        var e = p.e, A = boxes[e.from], B = boxes[e.to], dy = e.dy || 0, dx = e.dx || 0;
        var pl = !!(e.planned || p.a.planned || p.b.planned), spot = null, x, y, x2, y2, qa, qb;
        collect = [];
        edgePaths.push({ from: e.from, to: e.to, paths: collect });
        if (p.kind === 'down') {
          qa = portOf(p, 'a');
          if (e.pair) {
            x = s(A.cx + qa.offs[0] + dx); x2 = s(A.cx + qa.offs[1] + dx);
            path('M' + x + ' ' + A.b + ' V' + B.t, pl); arrow(x, B.t, 'down');
            path('M' + x2 + ' ' + B.t + ' V' + A.b, pl); arrow(x2, A.b, 'up');
          } else {
            x = s(A.cx + qa.off + dx);
            spot = poly([[x, A.b], [x, B.t]], pl); arrow(x, B.t, 'down');
          }
        } else if (p.kind === 'across') {
          qa = portOf(p, 'a');
          var toRight = B.cx > A.cx, xa = toRight ? A.r : A.l, xb = toRight ? B.l : B.r;
          if (e.pair) {
            y = s(A.cy + qa.offs[0] + dy); y2 = s(A.cy + qa.offs[1] + dy);
            path('M' + xa + ' ' + y + ' H' + xb, pl); arrow(xb, y, toRight ? 'right' : 'left');
            path('M' + xb + ' ' + y2 + ' H' + xa, pl); arrow(xa, y2, toRight ? 'left' : 'right');
            spot = { h: { len: Math.abs(xb - xa), x: (xa + xb) / 2, y: y } };
          } else {
            y = s(A.cy + qa.off + dy);
            spot = poly([[xa, y], [xb, y]], pl); arrow(xb, y, toRight ? 'right' : 'left');
          }
        } else if (p.kind === 'elbow') {
          qa = portOf(p, 'a'); qb = portOf(p, 'b');
          x = s(A.cx + qa.off); x2 = s(B.cx + qb.off); y = s(gapAbove(p.b.row) + dy);
          spot = poly([[x, A.b], [x, y], [x2, y], [x2, B.t]], pl); arrow(x2, B.t, 'down');
        } else {
          qa = portOf(p, 'a'); qb = portOf(p, 'b');
          var lx = p.x + dx, pts = [];
          if (p.aSide === 'bottom') {
            x = s(A.cx + qa.off); y = s(gapBelow(p.a.row));
            pts.push([x, A.b], [x, y], [lx, y]);
          } else {
            y = s(A.cy + qa.off + dy);
            pts.push([sideX(A, p.aSide), y], [lx, y]);
          }
          if (p.bSide === 'top') {
            x2 = s(B.cx + qb.off); y2 = s(gapAbove(p.b.row));
            pts.push([lx, y2], [x2, y2], [x2, B.t]);
            spot = poly(pts, pl); arrow(x2, B.t, 'down');
          } else {
            y2 = s(B.cy + qb.off + dy);
            var bx = sideX(B, p.bSide);
            pts.push([lx, y2], [bx, y2]);
            spot = poly(pts, pl); arrow(bx, y2, p.bSide === 'left' ? 'right' : 'left');
          }
        }
        label(e.label, spot);
      });
      collect = null;
      if (current) { if (!popup.hidden) place(nodes[current]); startFlow(current); updatePill(); }
    }

    draw();
    var ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { draw(); }); ro.observe(root); }
    else window.addEventListener('resize', draw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (grid.isConnected) draw(); });

    return function destroy() {
      stopFlow();
      clearTimeout(drawingTimer);
      clearTimeout(leaveTimer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', draw);
      root.innerHTML = '';
      root.classList.remove('flow-map', 'is-planned-on', 'is-narrow');
    };
  }

  global.createFlowMap = createFlowMap;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createFlowMap;
    module.exports.default = createFlowMap;
  }
})(typeof window !== 'undefined' ? window : this);
