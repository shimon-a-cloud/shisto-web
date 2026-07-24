#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""日本語フォントのサブセット管理ツール（shisto.jp）

このサイトの日本語フォント（Shippori Mincho 400 / Zen Kaku Gothic New 300・500）は、
index.html で実際に使っている文字だけを収録して自前配信している（834KB→268KB・2026-07-24）。

⚠️ index.html の文言に「新しい漢字」を足すと、その文字だけOS標準フォントで表示される
（目視では気づきにくい）。文言を変えたら必ず --check を実行すること。

使い方:
  python3 fonts/subset_tool.py --check   # index.htmlの全文字がフォントに収録済みか検査（漏れがあればexit 1）
  python3 fonts/subset_tool.py --build   # Google Fonts(GitHub)から原本TTFを取得し、現在のindex.htmlで再サブセット

依存: fontTools + brotli（無ければ fonts/.venv に自動インストール）
"""
import os, sys, subprocess, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
INDEX = os.path.join(ROOT, "index.html")
VENV = os.path.join(HERE, ".venv")

FONTS = [
    # (原本TTF: google/fonts リポジトリのパス, 出力woff2, weight)
    ("ofl/shipporimincho/ShipporiMincho-Regular.ttf", "shippori-400.woff2", 400),
    ("ofl/zenkakugothicnew/ZenKakuGothicNew-Light.ttf", "zenkaku-300.woff2", 300),
    ("ofl/zenkakugothicnew/ZenKakuGothicNew-Medium.ttf", "zenkaku-500.woff2", 500),
]

# 原本フォント自体に存在しない文字（検証済み 2026-07-24）。
# ─═＝HTMLコメントの飾り罫・｜＝<title>のみ・―＝保険セット由来で、いずれも画面には描画されない。
# Google Fonts配信時代から代替表示だった＝サブセット化による悪化ではない。
# ここに無い文字が「未収録」と出たら本物の漏れ＝必ず --build で再生成すること。
KNOWN_MISSING = set("─═｜―")


def ensure_venv():
    """fontTools+brotli が入ったvenvのpythonパスを返す（無ければ作る）"""
    py = os.path.join(VENV, "bin", "python3")
    if not os.path.exists(py):
        print("初回セットアップ: fonts/.venv に fontTools+brotli をインストールします…")
        subprocess.run([sys.executable, "-m", "venv", VENV], check=True)
        subprocess.run([py, "-m", "pip", "-q", "install", "fonttools", "brotli"], check=True)
    return py


def site_chars():
    """index.html の全文字（HTML全文＝JSが挿す文字も含む・取りこぼしゼロ方針）"""
    import string
    h = open(INDEX, encoding="utf-8").read()
    chars = set(h) | set(string.printable)
    chars |= set("。、・「」『』（）〜―…※→←↑↓■□●○◆★☆　％：；？！")
    return {c for c in chars if ord(c) >= 0x20 or c == "　"}


def check():
    py = ensure_venv()
    chars = site_chars()
    code = r"""
import sys, json
from fontTools.ttLib import TTFont
path, chars_file, known = sys.argv[1], sys.argv[2], set(sys.argv[3])
chars = set(open(chars_file, encoding="utf-8").read())
cmap = TTFont(path).getBestCmap()
missing = sorted(c for c in chars if ord(c) > 0x7F and ord(c) not in cmap and c not in known)
print(json.dumps(missing, ensure_ascii=False))
"""
    tmp = os.path.join(HERE, ".chars.tmp")
    open(tmp, "w", encoding="utf-8").write("".join(sorted(chars)))
    ng = False
    try:
        for _, out, _ in FONTS:
            woff = os.path.join(HERE, out)
            r = subprocess.run([py, "-c", code, woff, tmp, "".join(KNOWN_MISSING)], capture_output=True, text=True, check=True)
            import json as _json
            missing = _json.loads(r.stdout)
            if missing:
                ng = True
                print(f"❌ {out}: 未収録 {len(missing)}文字 → {''.join(missing[:30])}")
            else:
                print(f"✅ {out}: index.htmlの全文字を収録済み")
    finally:
        os.remove(tmp)
    if ng:
        print("\n→ `python3 fonts/subset_tool.py --build` で再生成してからデプロイしてください")
        sys.exit(1)


def build():
    py = ensure_venv()
    chars_file = os.path.join(HERE, ".chars.tmp")
    open(chars_file, "w", encoding="utf-8").write("".join(sorted(site_chars())))
    try:
        for src, out, _ in FONTS:
            ttf = os.path.join(HERE, "." + os.path.basename(src))
            url = f"https://raw.githubusercontent.com/google/fonts/main/{src}"
            print(f"取得中: {url}")
            urllib.request.urlretrieve(url, ttf)
            subprocess.run([
                os.path.join(VENV, "bin", "pyftsubset"), ttf,
                f"--text-file={chars_file}", "--flavor=woff2",
                "--layout-features=*", f"--output-file={os.path.join(HERE, out)}",
            ], check=True)
            os.remove(ttf)
            kb = os.path.getsize(os.path.join(HERE, out)) // 1024
            print(f"✅ {out}: {kb}KB")
    finally:
        os.remove(chars_file)
    check()


if __name__ == "__main__":
    if "--build" in sys.argv:
        build()
    elif "--check" in sys.argv:
        check()
    else:
        print(__doc__)
