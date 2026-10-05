#!/bin/sh
# このパソコンで「送信前の重さの点検」を有効にする（1回だけ・取り消しは git config --unset core.hooksPath）。
set -e
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath _perf/hooks
echo "🟢 有効にしました: git push の前に _perf/hooks/pre-push が動きます"
