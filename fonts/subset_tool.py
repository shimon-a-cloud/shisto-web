#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Webフォントのサブセット管理ツール（shisto.jp）

このサイトの日本語フォント（Shippori Mincho 400 / Zen Kaku Gothic New 300・500）は、
PAGES に挙げたページで実際に使っている文字だけを収録して自前配信している（834KB→268KB・2026-07-24）。
英字の Cormorant Garamond 300・400 も 2026-08-16 に自前配信へ移した
（Google Fonts の CSS が描画を887ms止めており、スマホLCPの主因だったため）。

⚠️ 文言に「新しい漢字」を足すと、その文字だけOS標準フォントで表示される
（目視では気づきにくい）。文言を変えたら必ず --check を実行すること。

🚨 このフォントを読み込むページを増やしたら PAGES に必ず足すこと。
   足し忘れると --check は✅を返すのに --build でそのページの文字が削られる
   （2026-08-16: works.html を追加。それ以前は index.html しか見ていなかった）。

使い方:
  python3 fonts/subset_tool.py --check   # PAGESの全文字がフォントに収録済みか検査（漏れがあればexit 1）
  python3 fonts/subset_tool.py --build   # Google Fonts(GitHub)から原本TTFを取得し、現在のPAGESで再サブセット

依存: fontTools + brotli（無ければ fonts/.venv に自動インストール）
"""
import os, sys, subprocess, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# 自前配信フォント（fonts/*.woff2）を @font-face で読み込んでいる公開ページ。
# privacy.html は 'Shippori Mincho' を指定しているが woff2 を読み込んでいないため対象外。
# preview-*.html は下書きで公開していないため対象外。
PAGES = [os.path.join(ROOT, p) for p in ("index.html", "works.html")]
VENV = os.path.join(HERE, ".venv")

FONTS = [
    # (原本TTF: google/fonts リポジトリのパス, 出力woff2, weight, 収録範囲, 原本の最低収録字数)
    #   収録範囲 "jp"    = PAGESの全文字（日本語書体）
    #   収録範囲 "latin" = LATIN_CHARS のみ（英字書体。日本語の字は元から入っていない）
    # 末尾の数字は「途中で切れた原本」を弾くための閾値（原本の実収録字数を下回る値）。
    ("ofl/shipporimincho/ShipporiMincho-Regular.ttf", "shippori-400.woff2", 400, "jp", 3000),
    ("ofl/zenkakugothicnew/ZenKakuGothicNew-Light.ttf", "zenkaku-300.woff2", 300, "jp", 3000),
    ("ofl/zenkakugothicnew/ZenKakuGothicNew-Medium.ttf", "zenkaku-500.woff2", 500, "jp", 3000),
    # Cormorant Garamond は可変フォント1本しか配布されていないため、wght=300/400 に切り出してから使う
    ("ofl/cormorantgaramond/CormorantGaramond[wght].ttf", "cormorant-300.woff2", 300, "latin", 400),
    ("ofl/cormorantgaramond/CormorantGaramond[wght].ttf", "cormorant-400.woff2", 400, "latin", 400),
]

# 原本フォント自体に存在しない文字（検証済み 2026-07-24）。
# ─═＝HTMLコメントの飾り罫・｜＝<title>のみ・―＝保険セット由来で、いずれも画面には描画されない。
# Google Fonts配信時代から代替表示だった＝サブセット化による悪化ではない。
# ここに無い文字が「未収録」と出たら本物の漏れ＝必ず --build で再生成すること。
KNOWN_MISSING = set("─═｜―")

# 英字書体（Cormorant Garamond）に収録する文字。
# 画面に出る英字・数字・記号は限られるが、あとから文言を足したときに1字だけ書体が変わる事故を
# 避けるため、ASCII可視文字＋欧文でよく使う約物＋Latin-1の文字までまとめて入れる（それでも軽い）。
# 🚨 U+00A0(NBSP) と U+00B7(・中黒の欧文版) は必須＝イントロの「AI · Web · Operations」で使っている。
LATIN_CHARS = (
    set(chr(c) for c in range(0x20, 0x7F))
    | set(chr(c) for c in range(0xA0, 0x100))
    | set("‐‑‒–—―‘’‚“”„†‡•…‰′″‹›⁄€™−")
)
# Cormorant Garamond の原本自体に無い文字（2026-08-16 に原本974字のcmapを直接見て確認）。
# µ(U+00B5 マイクロ記号)は原本に無い。ギリシャ文字のμ(U+03BC)は有る。どちらも画面では使っていない。
LATIN_KNOWN_MISSING = set("µ")


def ensure_venv():
    """fontTools+brotli が入ったvenvのpythonパスを返す（無ければ作る）"""
    py = os.path.join(VENV, "bin", "python3")
    if not os.path.exists(py):
        print("初回セットアップ: fonts/.venv に fontTools+brotli をインストールします…")
        subprocess.run([sys.executable, "-m", "venv", VENV], check=True)
        subprocess.run([py, "-m", "pip", "-q", "install", "fonttools", "brotli"], check=True)
    return py


def site_chars():
    """PAGES の全文字（HTML全文＝JSが挿す文字も含む・取りこぼしゼロ方針）"""
    import string
    missing_pages = [p for p in PAGES if not os.path.exists(p)]
    if missing_pages:
        # 黙って飛ばすとそのページの文字が削られる＝必ず止める
        print("❌ PAGES に無いファイル: " + ", ".join(os.path.basename(p) for p in missing_pages))
        sys.exit(1)
    h = "".join(open(p, encoding="utf-8").read() for p in PAGES)
    chars = set(h) | set(string.printable)
    chars |= set("。、・「」『』（）〜―…※→←↑↓■□●○◆★☆　％：；？！")
    return {c for c in chars if ord(c) >= 0x20 or c == "　"}


def check():
    py = ensure_venv()
    code = r"""
import sys, json
from fontTools.ttLib import TTFont
path, chars_file, known, min_ord = sys.argv[1], sys.argv[2], set(sys.argv[3]), int(sys.argv[4])
chars = set(open(chars_file, encoding="utf-8").read())
cmap = TTFont(path).getBestCmap()
missing = sorted(c for c in chars if ord(c) >= min_ord and ord(c) not in cmap and c not in known)
print(json.dumps(missing, ensure_ascii=False))
"""
    tmp = os.path.join(HERE, ".chars.tmp")
    ng = False
    try:
        for _, out, _, kind, _ in FONTS:
            if kind == "latin":
                chars, known, min_ord, label = LATIN_CHARS, LATIN_KNOWN_MISSING, 0x20, "英字・数字・約物"
            else:
                chars, known, min_ord = site_chars(), KNOWN_MISSING, 0x80
                label = "+".join(os.path.basename(p) for p in PAGES) + " の全文字"
            open(tmp, "w", encoding="utf-8").write("".join(sorted(chars)))
            woff = os.path.join(HERE, out)
            r = subprocess.run([py, "-c", code, woff, tmp, "".join(known), str(min_ord)],
                               capture_output=True, text=True, check=True)
            import json as _json
            missing = _json.loads(r.stdout)
            if missing:
                ng = True
                print(f"❌ {out}: 未収録 {len(missing)}文字 → {''.join(missing[:30])}")
            else:
                print(f"✅ {out}: {label}を収録済み")
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    if ng:
        print("\n→ `python3 fonts/subset_tool.py --build` で再生成してからデプロイしてください")
        sys.exit(1)


def build():
    py = ensure_venv()
    chars_file = os.path.join(HERE, ".chars.tmp")
    try:
        for src, out, weight, kind, min_cmap in FONTS:
            open(chars_file, "w", encoding="utf-8").write(
                "".join(sorted(LATIN_CHARS if kind == "latin" else site_chars())))
            ttf = os.path.join(HERE, "." + os.path.basename(src))
            url = f"https://raw.githubusercontent.com/google/fonts/main/{src}"
            print(f"取得中: {url}")
            # curl を使う（Pythonのurllibはこの環境でHTTPS本文が途中で切れることがある）。
            # --fail で HTTP エラーを、下の cmap 判定で「途中で切れた原本」を弾く。
            # -g（--globoff）が無いと可変フォントのファイル名 CormorantGaramond[wght].ttf の [ ] を
            # curl が範囲指定と解釈して落ちる
            subprocess.run(["curl", "-fsSLg", "-o", ttf, url], check=True)
            # 途中で切れた原本で作ると「静かに字が減ったwoff2」ができるので、開けるか確かめる
            v = subprocess.run([py, "-c", "import sys;from fontTools.ttLib import TTFont;print(len(TTFont(sys.argv[1]).getBestCmap()))", ttf],
                               capture_output=True, text=True)
            if v.returncode != 0 or int(v.stdout.strip() or 0) < min_cmap:
                print(f"❌ 原本が壊れています（{os.path.getsize(ttf):,}バイト・収録字数 {v.stdout.strip() or '読めない'}）: {url}")
                sys.exit(1)
            src_ttf = ttf
            if "[wght]" in src:
                # 可変フォントは指定ウェイトに切り出す（切り出さないと全ウェイト分の太さ情報を抱えたまま重くなる）
                inst = os.path.join(HERE, f".inst-{weight}.ttf")
                subprocess.run([os.path.join(VENV, "bin", "fonttools"), "varLib.instancer",
                                ttf, f"wght={weight}", "-o", inst], check=True, capture_output=True)
                src_ttf = inst
            # 英字書体は OpenType 機能を既定セット（カーニング・標準合字など）に絞る。
            # `*` にすると小型大文字・スワッシュなど画面で使っていない字形まで抱えて2倍になる
            # （実測 37KB→17KB。サイトのCSSに font-feature-settings / font-variant は無いことを確認済み）。
            features = [] if kind == "latin" else ["--layout-features=*"]
            subprocess.run([
                os.path.join(VENV, "bin", "pyftsubset"), src_ttf,
                f"--text-file={chars_file}", "--flavor=woff2",
                *features, f"--output-file={os.path.join(HERE, out)}",
            ], check=True)
            os.remove(ttf)
            if src_ttf != ttf:
                os.remove(src_ttf)
            kb = os.path.getsize(os.path.join(HERE, out)) // 1024
            print(f"✅ {out}: {kb}KB")
    finally:
        if os.path.exists(chars_file):
            os.remove(chars_file)
    check()


if __name__ == "__main__":
    if "--build" in sys.argv:
        build()
    elif "--check" in sys.argv:
        check()
    else:
        print(__doc__)
