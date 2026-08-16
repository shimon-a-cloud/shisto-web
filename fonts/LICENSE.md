# このフォルダのフォントについて

`fonts/*.woff2` は、下記のフォントを **SIL Open Font License 1.1（OFL）** のもとで
サブセット化（このサイトで使う文字だけを収録）して再配布しているものです。
生成手順は `fonts/subset_tool.py`、原本の取得元は google/fonts リポジトリです。

| ファイル | 原本 | 著作権表示 |
|---|---|---|
| `shippori-400.woff2` | Shippori Mincho Regular | Copyright 2021 The Shippori Mincho Project Authors (https://github.com/fontdasu/ShipporiMincho) |
| `zenkaku-300.woff2` / `zenkaku-500.woff2` | Zen Kaku Gothic New Light / Medium | Copyright 2022 The Zen Kaku Gothic Project Authors (https://github.com/googlefonts/zen-kakugothic) |
| `cormorant-300.woff2` / `cormorant-400.woff2` | Cormorant Garamond（可変フォントを wght=300 / 400 に切り出したもの） | Copyright 2015 the Cormorant Project Authors (github.com/CatharsisFonts/Cormorant) |
| `shistomono-400.woff2` / `shistomono-500.woff2` | **IBM Plex Mono** Regular / Medium（下記のとおり改名しています） | Copyright © 2017 IBM Corp. with Reserved Font Name "Plex" |

ライセンス全文：https://scripts.sil.org/OFL

OFL 1.1 の要点（このサイトが守っていること）：

- 改変（サブセット化・ウェイトの切り出し）と再配布が許諾されている
- 再配布物には上記の著作権表示とライセンスを添える（このファイルと、各woff2の内部の
  著作権・ライセンス記録の両方に入れている）
- フォント単体では販売しない

## 🚨 IBM Plex Mono を 'Shisto Mono' に改名している理由

IBM Plex は**予約名（Reserved Font Name）"Plex"** つきで公開されています。OFL 1.1 第3条により、
改変版は予約名を名乗れません。公式FAQ 2.6 は「webフォントのサブセット化は改変にあたる」と明記し、
同 2.7/2.8 は「元と同じ文字を全部収録している（Functional Equivalence）場合に限り例外」としています。
このサイトのサブセットは収録字数を減らしているため例外に当たりません。

そのため、フォント内部の名前（ファミリー名・フルネーム・PostScript名）だけを `Shisto Mono` に
書き換え、**著作権表示・ライセンス・商標の記録は原本のまま残しています**。
`works.html` の CSS も `'Shisto Mono'` を指定しています。**元の名前に戻さないでください。**

改名と検査は `fonts/subset_tool.py` が自動で行い、`--check` で予約名が残っていないか毎回確かめます。
