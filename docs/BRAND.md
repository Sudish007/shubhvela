# Shubhvela brand

शुभवेला · Shubhvela — शुभ (auspicious) + वेला (time, hour). An offline family almanac that computes; a serious tool,
not fortune telling. The brand is flat, geometric, two colours plus paper, light first.

## The mark: Lagna lattice

The North Indian kundli lattice reduced to its skeleton: a square, both diagonals and the midpoint diamond. The top
diamond is house 1, the **Lagna**, the point of the eastern horizon rising at this moment; it is the one filled
shape, in vermilion. The lattice reads as a chart to anyone who has seen a kundli, and as a clean geometric tile to
anyone who has not. It carries both ideas of the name: the chart (वेला as the moment that fixes the Lagna) and the
one auspicious window picked out of the whole.

### Construction (108 × 108 dp adaptive-icon canvas)

- Square 42 × 42 dp from (33, 33) to (75, 75), ink stroke 4 dp, miter joins, butt caps.
- Diagonals (33,33)→(75,75) and (75,33)→(33,75); midpoint diamond (54,33)–(75,54)–(54,75)–(33,54); same stroke.
- House 1 = polygon (54,33)–(64.5,43.5)–(54,54)–(43.5,43.5), filled vermilion, drawn **under** the strokes.
- All strokes are clipped to the square's outer edge (31…77), so no miter tip protrudes.
- Visible box 46 × 46 dp; its corners sit 32.5 dp from the centre, inside the 66 dp safe circle; the launcher
  window is the inner 72 dp (18…90). Nothing but paper outside the box.
- Adaptive layers: background = flat paper; foreground = the mark on transparent; monochrome = the same
  foreground as one alpha silhouette (ink and vermilion both opaque).
- Code: `app/brand/lib/mark.mjs` (`mark()`, `GRID`, `BOX`); vector exports `app/brand/mark.svg`,
  `mark-mono.svg`, `icon-adaptive-108.svg`.

### Clear space and minimum size

- Clear space around the mark: at least **¼ of the box** (11.5 dp at icon scale) on every side; in the launcher
  this is the paper tile, which must never be cropped tighter than the 72 dp window.
- Minimum size: **24 dp / 24 px** for the mark alone (the notification silhouette is drawn at 20 dp inside a 24 dp
  box, the practical floor). Below that the diamond and the lattice merge; use the wordmark instead.
- The mark is a fixed asset: paper tile, light-theme ink and vermilion in every context (never themed, never inverted
  except as the monochrome silhouette Android tints itself).

## Colours (verbatim from `packages/content/ui/design-tokens.json`)

| Role | Light | Dark (lockups and graphics on dark only) |
|---|---|---|
| paper | `#FAF7F2` | `#15130F` |
| ink | `#1C1A17` | `#F2EEE7` |
| vermilion / accent | `#B83E18` | `#E8835A` |
| ink-2 (secondary text) | `#5B554C` | `#C2BBAF` |
| ink-3 (tertiary) | `#6F6960` | `#9A9387` |
| hair-2 (rules) | `#CFC7BA` | `#4A443B` |

Icon, favicon and Play icon: paper + ink + vermilion only. Notification icon colour `#B83E18`; adaptive background
`#FAF7F2`; splash background `#FAF7F2`. Two colours plus paper, always flat.

## Type

- Display and wordmark: **Tiro Devanagari Hindi** (शुभवेला, "Shubhvela", headings in Devanagari).
- Body and Latin captions: **Noto Sans** (Regular, SemiBold) and **Noto Sans Devanagari**.
- Every brand asset renders text as `<path>` outlines from the TTFs in `app/assets/fonts/` through
  `app/brand/lib/text.mjs` (opentype.js plus a minimal Devanagari shaper). No system fonts, no SVG `<text>`.

### Wordmarks and lockups

- `wordmark-devanagari.svg` — शुभवेला in Tiro, ink. `wordmark-latin.svg` — Shubhvela in Tiro, ink.
- **Horizontal lockup** `[mark] शुभवेला · Shubhvela`: one baseline; mark 1.1 em of the Devanagari size, centred
  on the word's vertical span (+0.91 … −0.28 em); 0.4 em gap; the dot in ink-3; Latin at 0.887× so Tiro's cap height
  (0.699 em) meets the Devanagari head line (0.62 em). Files `lockup-horizontal-light.svg` / `-dark.svg`.
- **Stacked lockup**: mark 1.0 em above, 0.42 em gap, शुभवेला, then "Shubhvela" at 0.42 em in ink-2 with +14 %
  tracking. Files `lockup-stacked-light.svg` / `-dark.svg`.
- Light variants go on paper or light surfaces; dark variants only on the dark paper `#15130F` or darker.

## Compositions

- **Launcher / Play icon / favicon**: the 72 dp window of the adaptive canvas on the paper tile, square and
  full-bleed; no baked rounding, shadow or border (Android and Play apply their own masks).
- **Splash**: the mark alone, 96 dp visible height, centred on paper, nothing else (`splash.svg`; Android 12
  drawable = 288 dp canvas with the mark in the inner third).
- **Feature graphic 1024 × 500**: mark 264 px tall, 72 px gap, शुभवेला Tiro 116 / Shubhvela Tiro 46 ink-2 +3 px
  tracking / 64 × 4 vermilion rule / "Your family's Vedic almanac" Noto Sans 31 ink / "शुभ समय, आपके हाथ में" Noto
  Sans Devanagari 31 ink-2; the group centred (`feature-graphic.svg`).
- **Store screenshot frame 1080 × 1920**: paper; one caption line (Tiro 66 → 54 px for Devanagari, Noto Sans
  SemiBold 56 → 46 px for Latin, auto-fit, never below the floor) with a 48 × 4 vermilion rule; the capture at
  864 px wide inside an ink rounded frame (radius 72, bezel 18) that bleeds off the bottom edge
  (`screenshot-frame.svg`). Captions are adapted from `packages/content/ui/<lang>.json`; Bhojpuri in the respectful
  रउआ register. No ad banner may appear: the generator crops the AdMob test strip and extends the paper.
- **Open Graph 1200 × 630**: horizontal lockup at 80 % width, rule, one line in ink-2 (`web/public/brand/og-base.png`).

## Do / don't

Do: keep it flat; keep the paper tile; keep two colours plus paper; use the lockups as supplied; leave clear space;
use Tiro for the name and Noto Sans for everything else.

Don't: gradients, glow, neon, galaxy or star-field backgrounds, zodiac wheels, orbs or sparkles, 3D bevels, drop
shadows, stock art, emoji, more than two colours plus paper; don't recolour the mark; don't rotate or skew it; don't
put the mark on a photo; don't bake rounded corners into the icon; don't shrink the mark below 24 px; don't set the
name in any other face; no claims in captions that the app does not compute ("accurate predictions", testimonials,
invented numbers). The brand must stay visibly distinct from Astrotalk (yellow/orange), AstroSage (red/yellow) and
InstaAstro — never borrow their palettes or wheel motifs.

## File map

| Path | What |
|---|---|
| `app/brand/lib/mark.mjs`, `app/brand/lib/text.mjs` | the mark, lockups and compositions as code; text-to-path engine |
| `app/brand/*.svg` | vector exports: mark, mark-mono, icon-adaptive-108, wordmarks, lockups (light/dark), feature-graphic, splash, screenshot-frame |
| `app/assets/icon.png` 1024, `android-icon-foreground.png` 512, `android-icon-background.png` 512, `android-icon-monochrome.png` 432, `splash-icon.png` 1024, `favicon.png` 48 | Expo assets (file names fixed by `app/app.json`) |
| `app/android/app/src/main/res/mipmap-*/ic_launcher*.webp` | legacy 48 dp, round, adaptive foreground/background/monochrome 108 dp (mdpi…xxxhdpi) |
| `app/android/app/src/main/res/drawable-*/splashscreen_logo.png`, `notification_icon.png` | 288 dp splash drawable, 24 dp white notification silhouette |
| `app/android/app/src/main/res/values/colors.xml` | `splashscreen_background` and `iconBackground` = `#FAF7F2` |
| `app/playstore-assets/icon-512.png`, `feature-graphic-1024x500.png`, `screenshots/<lang>/NN-*.png`, `screenshots/sources.json` | Google Play kit and screenshot provenance |
| `web/public/brand/` | `logo.svg`, `logo-mono.svg`, `favicon.svg`, `favicon-32.png`, `favicon-180.png`, `og-base.png`, lockup SVG + PNG (light/dark) |
| `docs/PLAY-RELEASE-CHECKLIST.md` | release steps and the Play asset rules |

## Regenerate

```
node scripts/gen-brand-assets.mjs            # render everything, then validate
node scripts/gen-brand-assets.mjs --check    # validate only (exit 1 on any failure)
node scripts/gen-brand-assets.mjs --proof .agents/tasks/brand/proof   # + 48/36 px legibility proofs
```

Requirements: Node ≥ 24, the repo's `sharp` and `opentype.js` (already installed as dev dependencies), the TTFs in
`app/assets/fonts/`. Screenshots are rebuilt only when the emulator captures exist under
`.agents/tasks/v1-build/shots/` (gitignored): raw `phase-c/raw/<screen>-<lang>-light-390.png` (1080 × 2400) are
preferred, `phase-a`/`phase-b` 864 × 1920 captures are used as stand-ins and marked `pending` in `sources.json`.
`--check` enforces: sizes, channels and alpha of every output; the monochrome and notification layers are a single
colour; the adaptive foreground stays inside the 66 % safe circle; Play rules for icon, feature graphic and
screenshots (no alpha, 320–3840 px, ≤ 2:1, 2–8 per language, no near-black band = no baked ad banner); SVG sources
contain no gradient, filter, embedded image or `<text>` and use only design-token colours; `app.json` and
`colors.xml` reference the expected files and colours.
