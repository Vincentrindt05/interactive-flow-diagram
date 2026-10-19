#!/usr/bin/env python3
"""Turn an SVG drawing into compact path data for a flow-map background drawing.

    python3 scripts/compact_svg.py drawing.svg [--precision 0] [--pad 12] [--stroke WIDTH] [-o drawing.json]

- collects <path>, <polygon>, <polyline>, <line>, <rect>, <circle> and <ellipse> shapes into one path
- drops white background shapes (fill white/#fff/#ffffff) and anything inside <defs>
- crops the viewBox to the drawing (plus --pad units)
- rewrites the path with relative commands and rounded numbers, which is usually 2-3 times smaller
- prints JSON: {"viewBox": "...", "d": "...", "stroke": width-if-line-drawing}

Use the result as `drawing` of a group in the config. Transforms on groups or shapes are not applied:
flatten them first (for example in Inkscape: Path > Object to Path, then apply transforms).
"""
import argparse
import json
import math
import re
import sys
import xml.etree.ElementTree as ET

NUM = r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?'
WHITE = {'white', '#fff', '#ffffff', 'rgb(255,255,255)'}


def tag(el):
    return el.tag.split('}')[-1]


def style_of(el):
    st = {}
    for part in (el.get('style') or '').split(';'):
        if ':' in part:
            k, v = part.split(':', 1)
            st[k.strip()] = v.strip()
    for k in ('fill', 'stroke', 'stroke-width'):
        if el.get(k) is not None and k not in st:
            st[k] = el.get(k)
    return st


def parse_path(d):
    """Yield absolute segments: ('M', x, y) ('L', x, y) ('C', x1, y1, x2, y2, x, y) ('Q', ...) ('A', rx, ry, rot, large, sweep, x, y) ('Z',)."""
    toks = re.findall(r'[MmLlHhVvCcSsQqTtAaZz]|' + NUM, d)
    i, cmd = 0, None
    x = y = sx = sy = 0.0
    last_c = last_q = None
    out = []

    def num():
        nonlocal i
        v = float(toks[i]); i += 1
        return v

    while i < len(toks):
        t = toks[i]
        if re.match(r'[A-Za-z]', t):
            cmd = t; i += 1
            if cmd in 'Zz':
                out.append(('Z',)); x, y = sx, sy; last_c = last_q = None
                continue
        if cmd is None:
            break
        rel = cmd.islower(); C = cmd.upper()
        ox, oy = (x, y) if rel else (0.0, 0.0)
        if C == 'M':
            x, y = num() + ox, num() + oy; sx, sy = x, y
            out.append(('M', x, y)); cmd = 'l' if rel else 'L'; last_c = last_q = None
        elif C == 'L':
            x, y = num() + ox, num() + oy; out.append(('L', x, y)); last_c = last_q = None
        elif C == 'H':
            x = num() + (x if rel else 0); out.append(('L', x, y)); last_c = last_q = None
        elif C == 'V':
            y = num() + (y if rel else 0); out.append(('L', x, y)); last_c = last_q = None
        elif C in 'CS':
            if C == 'C':
                x1, y1 = num() + ox, num() + oy
            else:
                x1, y1 = (2 * x - last_c[0], 2 * y - last_c[1]) if last_c else (x, y)
            x2, y2 = num() + ox, num() + oy
            x, y = num() + ox, num() + oy
            out.append(('C', x1, y1, x2, y2, x, y)); last_c = (x2, y2); last_q = None
        elif C in 'QT':
            if C == 'Q':
                x1, y1 = num() + ox, num() + oy
            else:
                x1, y1 = (2 * x - last_q[0], 2 * y - last_q[1]) if last_q else (x, y)
            x, y = num() + ox, num() + oy
            out.append(('Q', x1, y1, x, y)); last_q = (x1, y1); last_c = None
        elif C == 'A':
            rx, ry, rot, large, sweep = num(), num(), num(), num(), num()
            x, y = num() + ox, num() + oy
            out.append(('A', rx, ry, rot, large, sweep, x, y)); last_c = last_q = None
    return out


def shape_to_path(el):
    t = tag(el)
    g = lambda k, dv=0.0: float(el.get(k, dv) or dv)
    if t == 'path':
        return el.get('d', '')
    if t in ('polygon', 'polyline'):
        pts = re.findall(NUM, el.get('points', ''))
        pairs = [(pts[i], pts[i + 1]) for i in range(0, len(pts) - 1, 2)]
        if not pairs:
            return ''
        d = 'M' + ' L'.join(a + ' ' + b for a, b in pairs)
        return d + (' Z' if t == 'polygon' else '')
    if t == 'line':
        return 'M%s %s L%s %s' % (g('x1'), g('y1'), g('x2'), g('y2'))
    if t == 'rect':
        x, y, w, h = g('x'), g('y'), g('width'), g('height')
        return 'M%s %s H%s V%s H%s Z' % (x, y, x + w, y + h, x)
    if t in ('circle', 'ellipse'):
        cx, cy = g('cx'), g('cy')
        rx = g('r') if t == 'circle' else g('rx')
        ry = g('r') if t == 'circle' else g('ry')
        return 'M%s %s A%s %s 0 1 0 %s %s A%s %s 0 1 0 %s %s Z' % (cx - rx, cy, rx, ry, cx + rx, cy, rx, ry, cx - rx, cy)
    return ''


def fmt(v, prec):
    s = ('%.' + str(prec) + 'f') % v
    if '.' in s:
        s = s.rstrip('0').rstrip('.')
    if s in ('-0', ''):
        s = '0'
    return s


def join(cmd, nums, prec):
    out = cmd
    for k, v in enumerate(nums):
        s = fmt(v, prec)
        if k and not s.startswith('-'):
            out += ' '
        out += s
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('svg')
    ap.add_argument('--precision', type=int, default=None, help='decimals (default: 0 for large drawings, 1 otherwise)')
    ap.add_argument('--pad', type=float, default=None, help='space around the drawing in viewBox units')
    ap.add_argument('--stroke', type=float, default=None, help='treat as a line drawing with this stroke width')
    ap.add_argument('-o', '--output')
    a = ap.parse_args()

    root = ET.parse(a.svg).getroot()
    defs = set()
    for d in root.iter():
        if tag(d) in ('defs', 'clipPath', 'mask', 'symbol'):
            defs.update(id(x) for x in d.iter())
    segs, strokes = [], []
    for el in root.iter():
        if id(el) in defs or tag(el) not in ('path', 'polygon', 'polyline', 'line', 'rect', 'circle', 'ellipse'):
            continue
        st = style_of(el)
        fill = (st.get('fill') or '').replace(' ', '').lower()
        if fill in WHITE and st.get('stroke', 'none') in ('none', ''):
            continue   # background
        if tag(el) == 'rect' and fill in WHITE:
            continue
        if st.get('fill') == 'none' and st.get('stroke', 'none') != 'none':
            try:
                strokes.append(float(re.findall(NUM, st.get('stroke-width', '1'))[0]))
            except IndexError:
                strokes.append(1.0)
        segs.extend(parse_path(shape_to_path(el)))
    if not segs:
        sys.exit('no shapes found')

    xs, ys = [], []
    for s in segs:
        if s[0] == 'A':
            rx, ry = s[1], s[2]
            xs += [s[6] - rx, s[6] + rx]; ys += [s[7] - ry, s[7] + ry]
        elif s[0] != 'Z':
            xs += list(s[1::2]); ys += list(s[2::2])
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    size = max(x1 - x0, y1 - y0)
    prec = a.precision if a.precision is not None else (0 if size > 500 else 1)
    stroke = a.stroke if a.stroke is not None else (max(strokes) if strokes and len(strokes) * 2 >= len(segs) // 50 + 1 else None)
    pad = a.pad if a.pad is not None else max(size * 0.01, (stroke or 0) * 2, 1)

    # relative output; positions are tracked in rounded coordinates so rounding errors do not add up
    r = lambda v: round(v, prec)
    out, cx, cy, sx, sy = [], 0.0, 0.0, 0.0, 0.0
    first = True
    for s in segs:
        c = s[0]
        if c == 'Z':
            out.append('z'); cx, cy = sx, sy
            continue
        if c == 'M':
            nx, ny = r(s[1]), r(s[2])
            out.append(join('M' if first else 'm', [nx, ny] if first else [nx - cx, ny - cy], prec))
            first = False
            cx, cy, sx, sy = nx, ny, nx, ny
        elif c == 'L':
            nx, ny = r(s[1]), r(s[2])
            if nx == cx:
                out.append(join('v', [ny - cy], prec))
            elif ny == cy:
                out.append(join('h', [nx - cx], prec))
            else:
                out.append(join('l', [nx - cx, ny - cy], prec))
            cx, cy = nx, ny
        elif c == 'C':
            p = [r(v) for v in s[1:]]
            out.append(join('c', [p[0] - cx, p[1] - cy, p[2] - cx, p[3] - cy, p[4] - cx, p[5] - cy], prec)); cx, cy = p[4], p[5]
        elif c == 'Q':
            p = [r(v) for v in s[1:]]
            out.append(join('q', [p[0] - cx, p[1] - cy, p[2] - cx, p[3] - cy], prec)); cx, cy = p[2], p[3]
        elif c == 'A':
            rx, ry, rot, large, sweep, nx, ny = s[1], s[2], s[3], int(s[4]), int(s[5]), r(s[6]), r(s[7])
            out.append('a' + ' '.join([fmt(rx, prec), fmt(ry, prec), fmt(rot, 1), str(large), str(sweep), fmt(nx - cx, prec), fmt(ny - cy, prec)]))
            cx, cy = nx, ny
    d = ''.join(out)
    # drop repeated command letters where the same command follows itself
    while True:
        nd = re.sub(r'([lhvcqa])([^a-zA-Z]+)(?:\1)', lambda m: m.group(1) + m.group(2) + ('' if m.group(2).endswith(' ') else ' '), d)
        if nd == d:
            break
        d = nd
    d = re.sub(r' +-', '-', d).replace('  ', ' ').strip()

    vb = ' '.join(fmt(v, prec) for v in (x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad))
    result = {'viewBox': vb, 'd': d}
    if stroke:
        result['stroke'] = stroke
    text = json.dumps(result)
    if a.output:
        open(a.output, 'w', encoding='utf-8').write(text)
        print('wrote', a.output, '(%d characters of path data)' % len(d), file=sys.stderr)
    else:
        print(text)


if __name__ == '__main__':
    main()
