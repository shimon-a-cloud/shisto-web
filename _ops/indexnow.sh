#!/bin/bash
# 公開後に Bing などへ「ページを更新した」と知らせる（IndexNow）。外向きの送信なので、実行は田中さんの承認後だけ。
# 使い方: bash _ops/indexnow.sh   （sitemap.xml の全URLを送る）
set -euo pipefail
cd "$(dirname "$0")/.."
KEY=$(ls | grep -E '^[0-9a-f]{32}\.txt$' | head -1 | sed 's/\.txt$//')
[ -n "$KEY" ] || { echo "鍵ファイルが見つかりません"; exit 1; }
# 鍵ファイルが本番に出ていないと相手側の確認で落ちるので、先に確かめる
[ "$(curl -s --max-time 10 "https://shisto.jp/$KEY.txt")" = "$KEY" ] || { echo "本番に鍵ファイルがまだ出ていません"; exit 1; }
URLS=$(grep -o '<loc>[^<]*' sitemap.xml | sed 's/<loc>//' | python3 -c 'import sys,json;print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')
BODY=$(printf '{"host":"shisto.jp","key":"%s","keyLocation":"https://shisto.jp/%s.txt","urlList":%s}' "$KEY" "$KEY" "$URLS")
for wait in 1 2 4; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST https://api.indexnow.org/indexnow \
    -H 'Content-Type: application/json; charset=utf-8' -d "$BODY") || CODE=000
  case "$CODE" in 200|202) echo "送信済み（HTTP ${CODE}）: $URLS"; exit 0;; 400|403|422) echo "拒否されました（HTTP ${CODE}）"; exit 1;; esac
  echo "HTTP $CODE → ${wait}秒後にやり直し"; sleep "$wait"
done
echo "3回とも失敗しました"; exit 1
