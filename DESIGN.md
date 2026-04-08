# Shisto Design System

## Brand Identity

**合同会社Shisto** — AI活用・Web制作・運用支援の実行型パートナー
元プロバスケ選手 → AI起業家という異色の経歴。
トーン：洗練・静謐・知的、しかし堅すぎない。温かみのあるプロフェッショナル。

## Colors

### Core Palette

| Token | Value | Usage |
|-------|-------|-------|
| `ink` | `#0A0A0A` | テキスト・ダーク背景・Hero |
| `paper` | `#F5F5F3` | メイン背景（暖かみのあるオフホワイト） |
| `snow` | `#FAFAF8` | カード・セクション背景（paperより明るい） |
| `mid` | `#888` | 補助テキスト |
| `rule` | `rgba(0,0,0,0.1)` | 罫線・ディバイダー |
| `accent` | `#4F46E5` | CTA・リンク・インタラクション（Indigo） |
| `accent-hover` | `#4338CA` | ホバー時のアクセント |

### Dark Context（Hero・モバイルメニュー）

| Element | Value |
|---------|-------|
| 背景 | `#0A0A0A` |
| テキスト | `#FFFFFF` |
| サブテキスト | `rgba(255,255,255,0.3)` ~ `rgba(255,255,255,0.6)` |
| CTA | `#4F46E5` on dark |

## Typography

### Font Stack

| Role | Family | Weight | Usage |
|------|--------|--------|-------|
| 本文 | Shippori Mincho | 400, 500 | 本文テキスト全般（明朝体で品格） |
| 見出し | Zen Kaku Gothic New | 300, 500 | セクションタイトル（Light weightで余白感） |
| ブランド名 | Cormorant Garamond | 300, 400 | ロゴ・Hero "Shisto" 表記 |
| UI・補助 | Noto Sans JP | 300, 400, 500 | ラベル・ボタン・ナビ（Interは削除済み） |

### Scale

| Element | Size | Weight | Spacing |
|---------|------|--------|---------|
| セクションラベル | 0.6rem | 500 | 0.28em, uppercase |
| セクションタイトル | clamp(2rem, 4.5vw, 3.8rem) | 300 | 0.06em |
| 本文 | 0.9rem | 400 | 0.06em |
| サービス詳細 | 0.8rem | 300 | — |
| CTA | 0.7rem | 400 | 0.06em |

### Base

```
font-size: 16px
letter-spacing: 0.06em
-webkit-font-smoothing: antialiased
```

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| section-y | 6rem ~ 10rem | セクション間の縦余白 |
| container-x | 3rem (PC) / 1.25rem (SP) | 左右パディング |
| max-width | 80rem | コンテンツ最大幅 |
| gap-sm | 0.75rem | 小要素間 |
| gap-md | 1.5rem | 中要素間 |
| gap-lg | 2.5rem | 大要素間 |

## Components

### Buttons (CTA)

```
padding: 0.65rem 1.5rem (small) / 1.1rem 2.4rem (large)
border-radius: 99px (pill)
background: #4F46E5
hover: #4338CA + box-shadow: 0 4px 16px rgba(79,70,229,0.3)
font-size: 0.7rem–0.85rem
letter-spacing: 0.06em
```

### Section Heading Pattern

```
<span class="sec-label">ENGLISH LABEL</span>    ← 0.6rem, uppercase, #555
<h2 class="sec-title">日本語タイトル</h2>        ← Zen Kaku Gothic, 300
```

### Service Row（アコーディオン）

```
grid: 3rem 1fr [auto 1.5rem on PC]
border-bottom: 0.5px solid rgba(0,0,0,0.1)
hover: 背景ink + テキストpaper（反転）
展開: max-height transition + 詳細リスト
```

### FAQ

```
<details> ベース
summary: cursor pointer, list-style none
icon: + → × (45deg rotate)
```

### Cards (snow背景)

```
background: #FAFAF8
border-radius: 16px–20px
padding: 2rem–3rem
```

## Animation & Motion

### Easing

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | メインのイージング（ほぼ全て） |
| `--ease-in-expo` | `cubic-bezier(0.7, 0, 0.84, 0)` | 退出アニメーション |
| `--ease-circ` | `cubic-bezier(0, 0.55, 0.45, 1)` | 円弧的な動き |

### Scroll Reveal

```
初期: opacity 0, translateY(36px)
表示: opacity 1, transform none
duration: 1s ease-expo
delay: data-d="1"~"6" (0.08s刻み)
```

### Hero

- 動画背景ループ（autoplay, muted, loop, playsinline / opacity 0.55）
- グラデーションオーバーレイ: 上部10%透過 → 下部50% → 最下部ink
- テキスト: スプリットアニメーション（1文字ずつ translateY 110%→0 + opacity）
  - brand-origin: 40ms/文字
  - brand-name: 80ms/文字（ゆったり）
  - brand-sub: 30ms/文字
- intro: ロゴ登場 → サブテキスト → プログレスバー → フェードアウト（初回のみ）

### Photo Marquee

```
2段（上: scroll-left, 下: scroll-right）
speed: 80s linear infinite
hover: scale(1.05) + caption fade-in
```

## Texture

- grain overlay: fractalNoise SVG, opacity 0.55, mix-blend-mode overlay
- 全ダークセクションに適用

## Responsive

### Breakpoint

- `768px` — PC/SPの切り替え

### SP固有ルール

- セクション数を削減（Flow・フォトマーキー・マーキー帯を非表示）
- パディング: 3rem → 1.25rem、セクション余白は約半分に圧縮
- Heroボタン: 縦並び・幅100%
- Servicesグリッド: 番号列 2rem、ギャップ 0.75rem
- Why Shisto: border-right 非表示
- ハンバーガーメニュー（フルスクリーン #0A0A0A、スクロール時は黒に色切替）
- 余白は詰め気味（スマホの長さ重視）

### 画像

- 全画像 WebP 形式（品質80）
- JPG は保持しない（WebP のみ）

## Do / Don't

### Do

- 余白で語る。要素を詰めすぎない（ただしスマホは長さ重視で詰め気味）
- 明朝体の品格を活かす
- アニメーションは上品に（ease-expo統一）
- ダークとライトのコントラストで緩急をつける
- CTAは indigo (#4F46E5) で統一

### Don't

- 派手な色を増やさない（ink + paper + accent の3色で十分）
- ドロップシャドウの多用（CTA hover の box-shadow のみ）
- 丸ゴシック・ポップなフォントを使わない
- 装飾的なアイコンを乱用しない
- グラデーション背景（Hero overlay以外）

## Content Guidelines

- CTA文言は「無料で相談する」で統一
- 「法人・個人問わず」を Services 導入文 + Contact 説明文に明記
- Founder 文は3段落以内（簡潔に）
- FAQ は重複を避けて4問以内に
