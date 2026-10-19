#!/usr/bin/env python3
"""Build one self-contained HTML file from a flow-map config.

    python3 scripts/build_standalone.py CONFIG OUTPUT.html [--title T] [--intro TEXT] [--footer HTML]

CONFIG is either a .json file with the config object, or a .js file that defines `var config = {...};`.
The engine (assets/flow-map.js), its styles (assets/flow-map.css) and the config are inlined into
assets/template.html, so the result opens in any browser without a server or internet connection.
"""
import argparse
import html
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent / 'assets'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('config')
    ap.add_argument('output')
    ap.add_argument('--title', default='Flow diagram')
    ap.add_argument('--intro', default='', help='one paragraph of plain text shown above the diagram')
    ap.add_argument('--footer', default='', help='HTML shown below the diagram (trusted input)')
    a = ap.parse_args()

    src = pathlib.Path(a.config)
    text = src.read_text(encoding='utf-8')
    if src.suffix == '.json':
        json.loads(text)  # fail early on invalid JSON
        config_js = 'var config = ' + text.strip() + ';'
    else:
        if 'config' not in text:
            sys.exit('the .js config must define `var config = {...};`')
        config_js = text

    # keep "</script>" inside strings from ending the inline script
    def safe(js):
        return js.replace('</script', '<\\/script')

    page = (HERE / 'template.html').read_text(encoding='utf-8')
    parts = {
        '{{TITLE}}': html.escape(a.title),
        '{{INTRO}}': '<p class="intro">' + html.escape(a.intro) + '</p>' if a.intro else '',
        '{{FOOTER}}': '<footer>' + a.footer + '</footer>' if a.footer else '',
        '{{CSS}}': (HERE / 'flow-map.css').read_text(encoding='utf-8'),
        '{{JS}}': safe((HERE / 'flow-map.js').read_text(encoding='utf-8')),
        '{{CONFIG}}': safe(config_js),
    }
    for key, value in parts.items():
        page = page.replace(key, value)
    pathlib.Path(a.output).write_text(page, encoding='utf-8')
    print('wrote', a.output, f'({len(page) // 1024} KB)')


if __name__ == '__main__':
    main()
