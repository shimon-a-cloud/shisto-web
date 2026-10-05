#!/usr/bin/env python3
"""表示の重さの関門（ラチェット）— Shisto サイト（shisto.jp）

改善した重さの数字を、次の公開で下回らせない（＝重くさせない）ための検査。標準ライブラリのみ。
GitHub へ送る直前（git push）に _perf/hooks/pre-push から自動で呼ばれ、上限を超えていたら送信を止める。

  python3 _perf/perf_ratchet.py                # いまのコミット（HEAD）を上限と比べる（読むだけ）
  python3 _perf/perf_ratchet.py --show         # いまの数字を一覧で出す
  python3 _perf/perf_ratchet.py --tighten      # 良くなった数字の上限を下げる・新しいページを登録する
  python3 _perf/perf_ratchet.py --raise <数字の名前> <今の値> --reason "…" --approved-by "田中志門"
                                               # 上限を上げる（田中さんの承認があるときだけ）
  python3 _perf/perf_ratchet.py --selftest     # 関門がわざと壊した物で本当に止まるかを確かめる
  sh _perf/install.sh                          # このパソコンで送信前の自動点検を有効にする（1回だけ）

背景（2026-10-05 田中さん決定・claude.dev「How we made claude.ai faster」から取り入れ）：
  一度軽くしても、後の小さな変更で少しずつ重くなる。気づいた時には戻せない。
  RAYUP（rayup-hp/perf_ratchet.py）と同じ規則で、Shisto サイトにも入れた。

RAYUP との違い（サイトの作りが違うため）：
  - 組み立ての工程が無い＝「コミットされた版」をそのまま測る（git archive で取り出す）。
    手元の未コミットの試作・preview-*.html は測らない（公開されないため）
  - 上限の台帳は、測るコミットの中の _perf/perf_ceiling.json を使う＝サイトと台帳が版ごとにそろう
  - 動画・外部から読む物（CDN・解析タグ等）・ページ埋め込み（iframe）も数える
  - フォントは「本数」だけ数え、大きさは測らない（下記）
  - 毎朝の自動反映は無い

測る数字（毎回同じ値が出るものだけ）：
  site:画像1枚の最大バイト / site:動画1本の最大バイト
  <ページ>:CSS合計バイト・JS合計バイト・画像合計バイト・動画合計バイト
  <ページ>:読込数      そのページが読む CSS・JS・画像・動画・フォント・埋め込みページの数（重複は1つ）
  <ページ>:外部読込数  ほかのサイトから読む CSS・JS・画像・埋め込みの数（CDN を戻す等の後退を止める）

測らないもの（理由）：
  - フォントの大きさ  文言に新しい漢字が入ると fonts/subset_tool.py --build で数百バイト増える
      ＝文言を直すたびに承認が要る関門は形だけになる。フォントは subset_tool.py --check が見張る。
      本数は数える（書体を足す・全文字版に戻すと読込数が増える）
  - HTML の大きさ     文言で毎回変わる
  - JS が後から取りに行く物  HTML・CSS から機械で辿れない（「画像1枚の最大」では見張っている）
  - 埋め込みページの中身  works.html の iframe は index.html を読む＝index.html の数字で見張る
  - 実際の表示速度（描くのが間に合わなかったコマ数など）  毎回ぶれる＝関門には使わない
      （../scripts/web-frames/web_frames.mjs --measure は参考値）

🚨 このリポジトリは公開されている（GitHub）。--reason に社名・金額・個人名を書かない。
"""

import datetime
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import unquote, urlsplit

PERF_DIR = Path(__file__).resolve().parent
REPO = PERF_DIR.parent
CEILING_REL = "_perf/perf_ceiling.json"
CEILING = REPO / CEILING_REL
SKIP_DIRS = ("_perf/",)                 # ページとして測らない

IMAGE_SUFFIXES = {".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".avif", ".ico"}
VIDEO_SUFFIXES = {".mp4", ".webm", ".mov", ".m4v"}
FONT_SUFFIXES = {".woff2", ".woff", ".ttf", ".otf"}

COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
CSS_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)
LINK_RE = re.compile(r"<link\b[^>]*>", re.I)
SCRIPT_RE = re.compile(r"<script\b[^>]*\bsrc=\"([^\"]+)\"", re.I)
MEDIA_TAG_RE = re.compile(r"<(?:img|source|video|input|iframe)\b[^>]*>", re.I)
MEDIA_ATTR_RE = re.compile(r'(?<![\w-])(?:data-)?(?:src|poster)="([^"]*)"', re.I)
ATTR_RE = lambda name: re.compile(r'(?<![\w-])%s="([^"]*)"' % name, re.I)
REL_RE, HREF_RE, AS_RE = ATTR_RE("rel"), ATTR_RE("href"), ATTR_RE("as")
SRCSET_RE = re.compile(r'(?<![\w-])(?:data-)?(?:srcset|imagesrcset)="([^"]+)"', re.I)
URL_RE = re.compile(r"url\(\s*['\"]?([^'\")]+)['\"]?\s*\)", re.I)
REMOTE = ("http://", "https://", "//")
NOT_A_FILE = ("data:", "mailto:", "tel:", "#", "about:", "javascript:")
LINK_LOADS = {"stylesheet", "preload", "modulepreload", "icon", "apple-touch-icon"}

SITE_IMG = "site:画像1枚の最大バイト"
SITE_VIDEO = "site:動画1本の最大バイト"


def resolve(ref, base_dir, root):
    """参照（styles/a.css?v=… や ../images/a.webp）をサイトの中のファイルにする。外部・存在しない物は None。"""
    ref = ref.strip()
    if not ref or ref.startswith(REMOTE + NOT_A_FILE):
        return None
    path = unquote(urlsplit(ref).path)
    target = (root / path.lstrip("/")) if path.startswith("/") else (base_dir / path)
    try:
        target = target.resolve()
        target.relative_to(root.resolve())
    except (OSError, ValueError):
        return None
    return target if target.is_file() else None


def rel(p, root):
    return p.relative_to(root.resolve()).as_posix()


def is_remote(ref):
    return ref.strip().startswith(REMOTE)


def page_refs(html_path, root):
    """1ページが読む物を種類ごとに {相対パス（外部は URL）: バイト} で返す。"""
    text = COMMENT_RE.sub("", html_path.read_text(encoding="utf-8"))
    d = html_path.parent
    b = {k: {} for k in ("css", "js", "img", "video", "font", "frame", "remote")}

    def add(ref, base_dir, hint=""):
        if is_remote(ref):
            b["remote"][ref.strip()] = 0
            return
        p = resolve(ref, base_dir, root)
        if not p:
            return
        s, r = p.suffix.lower(), rel(p, root)
        if s in IMAGE_SUFFIXES:
            b["img"][r] = p.stat().st_size
        elif s in VIDEO_SUFFIXES:
            b["video"][r] = p.stat().st_size
        elif s in FONT_SUFFIXES:
            b["font"][r] = p.stat().st_size
        elif s == ".js" or hint == "script":
            b["js"][r] = p.stat().st_size
        elif s == ".css" or hint == "style":
            b["css"][r] = p.stat().st_size
        elif s in (".html", ".htm"):
            b["frame"][r] = p.stat().st_size

    def add_srcset(value, base_dir):
        for part in value.split(","):
            if part.strip():
                add(part.strip().split()[0], base_dir)

    for tag in LINK_RE.findall(text):
        rels = set((REL_RE.search(tag) or [None, ""])[1].lower().split())
        href = HREF_RE.search(tag)
        if href and rels & LINK_LOADS:
            kind = (AS_RE.search(tag) or [None, ""])[1].lower()
            add(href.group(1), d, "style" if "stylesheet" in rels else kind)
        for value in SRCSET_RE.findall(tag):
            add_srcset(value, d)

    for src in SCRIPT_RE.findall(text):
        add(src, d, "script")

    for tag in MEDIA_TAG_RE.findall(text):      # src・data-src（後から差し込む画像も数える）・poster
        for ref in MEDIA_ATTR_RE.findall(tag):
            add(ref, d)
        for value in SRCSET_RE.findall(tag):
            add_srcset(value, d)

    for ref in URL_RE.findall(text):            # style="background:url(…)" と <style> の中（@font-face も）
        add(ref, d)
    for css_rel in list(b["css"]):              # 読む CSS の中の背景画像・フォント
        css_path = root / css_rel
        for ref in URL_RE.findall(CSS_COMMENT_RE.sub("", css_path.read_text(encoding="utf-8"))):
            add(ref, css_path.parent)
    return b


def measure(root):
    """いまの数字を {名前: {"value": 数, "files": {相対パス: バイト}}} で返す。"""
    root = Path(root)
    metrics = {}
    files = [p for p in root.rglob("*") if p.is_file()
             and not any(rel(p.resolve(), root).startswith(s) for s in SKIP_DIRS)]
    for key, suffixes in ((SITE_IMG, IMAGE_SUFFIXES), (SITE_VIDEO, VIDEO_SUFFIXES)):
        sizes = {rel(p.resolve(), root): p.stat().st_size for p in files if p.suffix.lower() in suffixes}
        if sizes:
            top = max(sizes, key=lambda k: (sizes[k], k))
            metrics[key] = {"value": sizes[top], "files": {top: sizes[top]}}
    for page in sorted(p for p in files if p.suffix.lower() == ".html"):
        name = rel(page.resolve(), root)
        b = page_refs(page, root)
        for label, key in (("CSS合計バイト", "css"), ("JS合計バイト", "js"),
                           ("画像合計バイト", "img"), ("動画合計バイト", "video")):
            metrics["%s:%s" % (name, label)] = {"value": sum(b[key].values()), "files": b[key]}
        local = sorted({k for key in ("css", "js", "img", "video", "font", "frame") for k in b[key]})
        metrics["%s:読込数" % name] = {"value": len(local), "files": {k: 1 for k in local}}
        metrics["%s:外部読込数" % name] = {"value": len(b["remote"]), "files": {k: 1 for k in sorted(b["remote"])}}
    return metrics


@contextmanager
def snapshot(rev="HEAD", repo=REPO):
    """コミット rev の中身だけを一時フォルダに取り出す（未コミットの物・preview は入らない）。"""
    tmp = Path(tempfile.mkdtemp(prefix="shisto-perf-"))
    try:
        data = subprocess.run(["git", "-C", str(repo), "archive", "--format=tar", rev],
                              check=True, capture_output=True).stdout
        with tarfile.open(fileobj=io.BytesIO(data)) as tar:
            tar.extractall(tmp, filter="data")
        yield tmp
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def load_ceiling(path):
    """上限の台帳を読む。無い・壊れている時は例外（黙って通さない）。"""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data.get("metrics"), dict) or not data["metrics"]:
        raise ValueError("metrics が空です")
    for k, v in data["metrics"].items():
        if not isinstance(v.get("ceiling"), int):
            raise ValueError("%s の ceiling が整数ではありません" % k)
    return data


def explain_growth(now_files, then_files, unit):
    """何がどれだけ増えたかを1行にする。"""
    parts = []
    for f in sorted(set(now_files) | set(then_files)):
        a, b = then_files.get(f, 0), now_files.get(f, 0)
        if f not in then_files:
            parts.append("%s（新しく読む%s）" % (f, "・+%s%s" % (format(b, ","), unit) if b else ""))
        elif b > a:
            parts.append("%s +%s%s（%s→%s）" % (f, format(b - a, ","), unit, format(a, ","), format(b, ",")))
    return "・".join(parts[:6]) + (" ほか%d件" % (len(parts) - 6) if len(parts) > 6 else "")


def check(root, ceiling_path):
    """上限と比べた結果を [(FAIL/WARN, 規則, 文)] で返す。ファイルは書き換えない。"""
    try:
        data = load_ceiling(ceiling_path)
    except FileNotFoundError:
        return [("FAIL", "perf-ratchet", "上限の台帳 %s がありません（python3 _perf/perf_ratchet.py --tighten で作り、コミットしてください）"
                 % CEILING_REL)]
    except (ValueError, json.JSONDecodeError) as e:
        return [("FAIL", "perf-ratchet", "上限の台帳 %s が読めません: %s" % (CEILING_REL, e))]

    now = measure(root)
    pages = [k for k in now if not k.startswith("site:")]
    if SITE_IMG not in now or not pages:
        return [("FAIL", "perf-ratchet", "測れた数字がありません（画像かページが無い）＝関門が空回りしています")]

    results, better = [], []
    for name, c in sorted(data["metrics"].items()):
        if name not in now:
            results.append(("WARN", "perf-ratchet-stale",
                            "上限の台帳にあるのに今は無い数字: %s（ページを消したなら --tighten で台帳から外れます）" % name))
            continue
        value, ceiling = now[name]["value"], c["ceiling"]
        unit = "件" if name.endswith("読込数") else "バイト"
        if value > ceiling:
            if name.startswith("site:"):
                why = "いま一番重いのは %s（上限を決めた時の一番は %s）" % (
                    ", ".join(now[name]["files"]), ", ".join(c.get("files", {})) or "不明")
            else:
                why = "増えた物: " + explain_growth(now[name]["files"], c.get("files", {}), "" if unit == "件" else "B")
            results.append(("FAIL", "perf-ratchet",
                            "%s が上限を超えました: %s → %s %s（+%s）。%s。"
                            "軽くして戻すか、どうしても要るなら田中さんの承認を得て "
                            "python3 _perf/perf_ratchet.py --raise \"%s\" %d --reason \"…\" --approved-by \"田中志門\" → 台帳をコミット"
                            % (name, format(ceiling, ","), format(value, ","), unit,
                               format(value - ceiling, ","), why, name, value)))
        elif value < ceiling:
            better.append("%s %s→%s" % (name, format(ceiling, ","), format(value, ",")))
    for name in sorted(set(now) - set(data["metrics"])):
        results.append(("WARN", "perf-ratchet-new",
                        "上限が未登録の数字: %s＝%s（新しいページなら python3 _perf/perf_ratchet.py --tighten で登録）"
                        % (name, format(now[name]["value"], ","))))
    if better:
        results.append(("WARN", "perf-ratchet-better",
                        "%d件が上限より良くなっています（%s）。python3 _perf/perf_ratchet.py --tighten で上限を下げてコミットしてください"
                        % (len(better), "・".join(better[:4]) + (" ほか" if len(better) > 4 else ""))))
    return results


def check_rev(rev="HEAD", repo=REPO):
    """コミット rev を、そのコミットに入っている台帳と比べる（サイトと台帳を版ごとにそろえる）。"""
    with snapshot(rev, repo) as root:
        return check(root, root / CEILING_REL)


def today():
    return datetime.date.today().isoformat()


def save(data, path):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=False) + "\n",
                          encoding="utf-8")


def tighten(root, ceiling_path=CEILING):
    """良くなった上限だけ下げる。未登録の数字は今の値で登録し、無くなった数字は外す。上げることは決してしない。"""
    path = Path(ceiling_path)
    if path.exists():
        data = load_ceiling(path)
    else:
        data = {"説明": "表示の重さの上限（_perf/perf_ratchet.py）。上げるのは --raise（田中さんの承認＋理由）だけ。手で書き換えない",
                "metrics": {}, "history": []}
    now = measure(root)
    if SITE_IMG not in now:
        raise SystemExit("🔴 測る版に画像がありません")
    changed = []
    for name, m in sorted(now.items()):
        old = data["metrics"].get(name)
        if old is None:
            data["metrics"][name] = {"ceiling": m["value"], "files": m["files"]}
            changed.append({"date": today(), "kind": "登録", "metric": name, "to": m["value"]})
        elif m["value"] < old["ceiling"]:
            changed.append({"date": today(), "kind": "下げた", "metric": name,
                            "from": old["ceiling"], "to": m["value"]})
            data["metrics"][name] = {"ceiling": m["value"], "files": m["files"]}
    for name in sorted(set(data["metrics"]) - set(now)):
        changed.append({"date": today(), "kind": "外した（今は無い）", "metric": name,
                        "from": data["metrics"].pop(name)["ceiling"]})
    data.setdefault("history", []).extend(changed)
    save(data, path)
    return changed


def raise_ceiling(root, name, value, reason, approved_by, ceiling_path=CEILING):
    """上限を上げる。理由と承認者が無ければ断る。今の値より高い上限は付けない（余裕を持たせない）。"""
    if not reason.strip() or not approved_by.strip():
        raise SystemExit("🔴 上限を上げるには --reason と --approved-by が要ります")
    data = load_ceiling(ceiling_path)
    if name not in data["metrics"]:
        raise SystemExit("🔴 その名前の数字は台帳にありません: %s" % name)
    now = measure(root)
    if name not in now:
        raise SystemExit("🔴 今は測れない数字です: %s" % name)
    old = data["metrics"][name]["ceiling"]
    if value <= old:
        raise SystemExit("🔴 %d は今の上限 %d 以下です（下げるのは --tighten）" % (value, old))
    if value != now[name]["value"]:
        raise SystemExit("🔴 上限は今の値 %d ちょうどにしてください（指定 %d）。余裕を持たせると次の悪化が素通りします"
                         % (now[name]["value"], value))
    data["metrics"][name] = {"ceiling": value, "files": now[name]["files"]}
    data.setdefault("history", []).append({"date": today(), "kind": "上げた", "metric": name,
                                           "from": old, "to": value, "reason": reason.strip(),
                                           "approved_by": approved_by.strip()})
    save(data, ceiling_path)


def print_results(results):
    fails = 0
    for level, rule, msg in results:
        fails += level == "FAIL"
        print("%s %s  [%s] %s" % ("🔴" if level == "FAIL" else "🟡", level, rule, msg))
    return fails


def run_hook(stdin_text, repo=REPO):
    """git push の直前に呼ばれる。main へ送るコミットを1つずつ測り、上限超えがあれば 1 を返す（送信を止める）。"""
    fails = checked = 0
    for line in stdin_text.splitlines():
        parts = line.split()
        if len(parts) != 4:
            continue
        _local_ref, local_sha, remote_ref, _remote_sha = parts
        if remote_ref != "refs/heads/main" or set(local_sha) == {"0"}:
            continue                            # 公開されるのは main だけ・ブランチ削除は測らない
        checked += 1
        print("── 表示の重さの関門: %s を測ります" % local_sha[:7])
        fails += print_results(check_rev(local_sha, repo))
    if fails:
        print("🔴 上限超えのため送信を止めました（shisto.jp は変わっていません）")
        return 1
    if checked:
        print("🟢 表示の重さの関門: 上限超えなし")
    return 0


def arg(flag):
    if flag not in sys.argv:
        return ""
    i = sys.argv.index(flag)
    return sys.argv[i + 1] if i + 1 < len(sys.argv) else ""


# ───────── 自己テスト（わざと壊した物で関門が鳴るか） ─────────

def _site(tmp):
    """小さな使い捨てのサイトを作る。"""
    root = Path(tempfile.mkdtemp(dir=tmp))
    (root / "styles").mkdir()
    (root / "images").mkdir()
    (root / "fonts").mkdir()
    (root / "videos").mkdir()
    (root / "styles" / "a.css").write_text("body{background:url('../images/bg.webp')}", encoding="utf-8")
    (root / "images" / "bg.webp").write_bytes(b"x" * 1000)
    (root / "images" / "lazy.webp").write_bytes(b"x" * 500)
    (root / "fonts" / "f.woff2").write_bytes(b"x" * 300)
    (root / "videos" / "v.mp4").write_bytes(b"x" * 2000)
    (root / "index.html").write_text(
        '<link rel="stylesheet" href="styles/a.css?v=1"><style>@font-face{src:url(\'fonts/f.woff2\')}</style>'
        '<img src="data:image/gif;base64,R0" data-src="images/lazy.webp"><video src="videos/v.mp4"></video>',
        encoding="utf-8")
    (root / "works.html").write_text('<iframe data-src="index.html"></iframe>', encoding="utf-8")
    return root


def selftest():
    ok = True

    def expect(label, cond):
        nonlocal ok
        ok &= bool(cond)
        print("%s %s" % ("🟢" if cond else "🔴", label))

    def fails(root, ceiling):
        return [r for r in check(root, ceiling) if r[0] == "FAIL"]

    tmp = Path(tempfile.mkdtemp(prefix="shisto-perf-selftest-"))
    try:
        root = _site(tmp)
        ceiling = root / CEILING_REL
        (root / "_perf").mkdir()
        tighten(root, ceiling)
        m = measure(root)
        expect("後から差し込む画像（data-src）・CSS の背景・動画・フォント・埋め込みページを数える",
               m["index.html:画像合計バイト"]["value"] == 1500 and m["index.html:動画合計バイト"]["value"] == 2000
               and m["index.html:読込数"]["value"] == 5 and m["works.html:読込数"]["value"] == 1)
        expect("作った直後は上限超えなし", not fails(root, ceiling))

        (root / "images" / "bg.webp").write_bytes(b"x" * 3_000_000)
        f = fails(root, ceiling)
        expect("重い画像を入れると止まり、ファイル名と増えた量を出す",
               f and any("bg.webp" in r[2] and "+2,999,000" in r[2] for r in f))
        (root / "images" / "bg.webp").write_bytes(b"x" * 1000)

        (root / "index.html").write_text((root / "index.html").read_text(encoding="utf-8")
                                         + '<script src="https://cdn.tailwindcss.com"></script>', encoding="utf-8")
        expect("外部の読み込み（CDN）を足すと止まる",
               any("外部読込数" in r[2] and "cdn.tailwindcss.com" in r[2] for r in fails(root, ceiling)))
        (root / "index.html").write_text((root / "index.html").read_text(encoding="utf-8")
                                         .replace('<script src="https://cdn.tailwindcss.com"></script>', ""), encoding="utf-8")

        (root / "fonts" / "f.woff2").write_bytes(b"x" * 900)
        expect("フォントの大きさが変わっても止まらない（文言の修正で毎回変わるため）", not fails(root, ceiling))
        (root / "fonts" / "g.woff2").write_bytes(b"x" * 300)
        (root / "index.html").write_text((root / "index.html").read_text(encoding="utf-8")
                                         + "<style>@font-face{src:url('fonts/g.woff2')}</style>", encoding="utf-8")
        expect("フォントの本数が増えると止まる", any("読込数" in r[2] for r in fails(root, ceiling)))

        root2 = _site(tmp)
        (root2 / "_perf").mkdir()
        c2 = root2 / CEILING_REL
        tighten(root2, c2)
        (root2 / "images" / "lazy.webp").write_bytes(b"x" * 100)
        tighten(root2, c2)
        expect("軽くなったら上限が下がる", load_ceiling(c2)["metrics"]["index.html:画像合計バイト"]["ceiling"] == 1100)
        (root2 / "images" / "lazy.webp").write_bytes(b"x" * 500)
        expect("下がった上限は戻らない（元の重さに戻すと止まる）", fails(root2, c2))
        for args in (("", "田中志門"), ("理由", "")):
            try:
                raise_ceiling(root2, "index.html:画像合計バイト", 1500, *args, ceiling_path=c2)
                expect("理由か承認者が無い上げ方を断る", False)
            except SystemExit:
                expect("理由か承認者が無い上げ方を断る", True)
        try:
            raise_ceiling(root2, "index.html:画像合計バイト", 2000, "理由", "田中志門", ceiling_path=c2)
            expect("今の値より高い上限を断る", False)
        except SystemExit:
            expect("今の値より高い上限を断る", True)
        raise_ceiling(root2, "index.html:画像合計バイト", 1500, "テスト", "田中志門", ceiling_path=c2)
        h = load_ceiling(c2)["history"][-1]
        expect("承認つきなら上がり、理由と承認者が履歴に残る",
               not fails(root2, c2) and h["reason"] == "テスト" and h["approved_by"] == "田中志門")

        expect("台帳が無いと止まる", fails(root2, root2 / "_perf" / "none.json"))
        (root2 / "_perf" / "bad.json").write_text("{", encoding="utf-8")
        expect("台帳が壊れていると止まる", fails(root2, root2 / "_perf" / "bad.json"))
        empty = Path(tempfile.mkdtemp(dir=tmp))
        expect("測れる物が0件だと止まる（空回りさせない）", fails(empty, c2))

        _selftest_push(tmp, expect)            # 結果は expect が ok に書く（&= だと先に読んだ ok で上書きされる）
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print("🟢 自己テスト合格" if ok else "🔴 自己テスト不合格")
    return 0 if ok else 1


def _selftest_push(tmp, expect):
    """実際に git push して、重い画像のコミットが送信前に止まり、軽い物は通るかを確かめる。"""
    env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.invalid",
           "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.invalid"}

    def git(cwd, *a):
        return subprocess.run(["git", "-C", str(cwd), *a], capture_output=True, text=True, env=env)

    bare = tmp / "remote.git"
    work = _site(tmp)
    git(tmp, "init", "-q", "--bare", str(bare))
    git(work, "init", "-q", "-b", "main")
    (work / "_perf" / "hooks").mkdir(parents=True)
    shutil.copy(__file__, work / "_perf" / "perf_ratchet.py")
    shutil.copy(PERF_DIR / "hooks" / "pre-push", work / "_perf" / "hooks" / "pre-push")
    os.chmod(work / "_perf" / "hooks" / "pre-push", 0o755)
    git(work, "config", "core.hooksPath", "_perf/hooks")
    git(work, "remote", "add", "origin", str(bare))
    tighten(work, work / CEILING_REL)
    git(work, "add", "-A")
    git(work, "commit", "-qm", "base")
    first = git(work, "push", "-q", "origin", "main")
    expect("送信前の点検：上限内のコミットは送れる", first.returncode == 0)

    (work / "images" / "bg.webp").write_bytes(b"x" * 3_000_000)
    git(work, "commit", "-qam", "heavy")
    heavy = git(work, "push", "-q", "origin", "main")
    sent = git(bare, "rev-parse", "main").stdout.strip()
    expect("送信前の点検：重い画像のコミットは送信が止まり、送り先は変わらない",
           heavy.returncode != 0 and "bg.webp" in heavy.stdout + heavy.stderr
           and sent != git(work, "rev-parse", "HEAD").stdout.strip())

    (work / "images" / "bg.webp").write_bytes(b"x" * 1000)
    (work / "draft.webp").write_bytes(b"x" * 5_000_000)   # コミットしない試作は測らない
    git(work, "commit", "-qm", "light", "--", "images/bg.webp")
    light = git(work, "push", "-q", "origin", "main")
    expect("送信前の点検：コミットしていない重い試作は測らず、軽く戻したら送れる", light.returncode == 0)


def main():
    if "--selftest" in sys.argv:
        return selftest()
    if "--hook" in sys.argv:
        return run_hook(sys.stdin.read())
    rev = arg("--rev") or "HEAD"
    if "--show" in sys.argv:
        with snapshot(rev) as root:
            for name, m in measure(root).items():
                print("%-40s %12s" % (name, format(m["value"], ",")))
        return 0
    if "--tighten" in sys.argv:
        with snapshot(rev) as root:
            changed = tighten(root)
        for c in changed:
            print("🟢 %s %s %s" % (c["kind"], c["metric"],
                                   "%s→%s" % (format(c.get("from", 0), ","), format(c.get("to", 0), ","))))
        print("🟢 変更 %d件（%s）。コミットすると次の送信から効きます" % (len(changed), CEILING_REL))
        return 0
    if "--raise" in sys.argv:
        i = sys.argv.index("--raise")
        try:
            name, value = sys.argv[i + 1], int(sys.argv[i + 2])
        except (IndexError, ValueError):
            raise SystemExit('🔴 使い方: --raise "<数字の名前>" <今の値> --reason "…" --approved-by "…"')
        with snapshot(rev) as root:
            raise_ceiling(root, name, value, arg("--reason"), arg("--approved-by"))
        print("🟢 上限を上げました: %s → %s（理由と承認者を履歴に残しました）。台帳をコミットしてください"
              % (name, format(value, ",")))
        return 0
    fails = print_results(check_rev(rev))
    print("🔴 上限超えあり" if fails else "🟢 上限超えなし")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
