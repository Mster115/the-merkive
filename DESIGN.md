# The Merkive — Design System & Style Guide

Welcome to the design specification for **The Merkive** (formerly Merky Box). This document serves as the canonical single source of truth for visual design, UI components, typography, layout patterns, motion, and accessibility contracts across the monorepo.

---

## 1. Core Aesthetics & Philosophy

The Merkive utilizes a **Neo-Brutalist "Game Night"** aesthetic — loud, chunky, high-contrast, and dynamic, yet clean and legible across all device forms.

### Design Principles:
1. **Hard Outlines & Offset Slab Shadows**: Elements sit on thick, 2px to 4px pure black (`#000000`) borders with un-blurred, 90-degree directional slab shadows (`4px 4px 0 0 #000`). No soft drop-shadows or translucent blurs.
2. **Saturated Color Plates**: Backgrounds are deep navy/midnight surfaces (`#0b1326`), while interactive targets, badges, and status chips burst with flat, saturated primary tones (`--mb-accent`, `--mb-accent-2`, `--mb-gold`, `--mb-pink`).
3. **Display Typography & Sticker Headers**: Hero moments, room codes, titles, and card indices use **Anybody** — bold, uppercase, italicized, and occasionally rotated with hard sticker text-shadows (`.mb-neon-*`).
4. **Physical Haptics & Press Feelings**: Buttons and pressable targets sink directly into their offset shadows when active (`.mb-press`). Hover states on cards translate into the slab shadow (`.mb-lift`).
5. **Multi-Screen Form Factors**:
   - **Stage (TV)**: Legible at 10 feet with massive display typography, live ticker banners, and high-visibility status indicators.
   - **Controller (Mobile)**: Optimized for single-hand touch control at 360px width with minimum 44px touch targets (`min-h-11`).

---

## 2. Color Tokens & Theme Palette

All colors are declared in `packages/ui/src/tokens.css` as frozen CSS variables.

### Surface & Background Tokens
| Token | Hex Value | Role / Usage |
| :--- | :--- | :--- |
| `--mb-bg` | `#0b1326` | Main app background (Deep Navy) |
| `--mb-bg-2` | `#131b2e` | Secondary background wash |
| `--mb-surface` | `#171f33` | Primary card & container surface |
| `--mb-surface-2` | `#222a3e` | Nested panel / elevated plate background |
| `--mb-surface-3` | `#2d3449` | Deep nested container / disabled slot |

### Line & Text Tokens
| Token | Hex Value | Role / Usage |
| :--- | :--- | :--- |
| `--mb-line` | `#000000` | Hard border outlines (Pure Black) |
| `--mb-line-bright` | `#ddb7ff` | Highlight focus border |
| `--mb-line-dim` | `#4d4354` | Dashed placeholder outlines |
| `--mb-text` | `#dbe2fd` | Primary high-contrast body text |
| `--mb-text-dim` | `#cfc2d6` | Secondary / muted text & labels |
| `--mb-paper` | `#ffffff` | Crisp white paper face (playing cards, QR codes) |
| `--mb-ink` | `#000000` | Pure black text on paper plates |

### Brand & Functional Tone Tokens
| Tone | Background Token | Text/On Token | Usage |
| :--- | :--- | :--- | :--- |
| **Accent (Purple)** | `--mb-accent` (`#b76dff`) | `--mb-on-accent` (`#2c0051`) | Primary CTAs, active selection |
| **Accent-2 (Green)**| `--mb-accent-2` (`#4ae176`)| `--mb-on-accent-2` (`#003915`)| Join, ready, success badges |
| **Violet (Lavender)**| `--mb-violet` (`#ddb7ff`) | `--mb-ink` (`#000000`) | Hero titles & section headers |
| **Pink (Party Pink)**| `--mb-pink` (`#ffb2b7`) | `--mb-on-pink` (`#67001b`) | Skip badges, action alerts |
| **Gold (Gold)** | `--mb-gold` (`#ffc53d`) | `--mb-on-gold` (`#3a2a00`) | Winners, trophy, wild cards |
| **Danger (Red)** | `--mb-danger` (`#ff5d5d`) | `--mb-on-danger` (`#40000d`)| Draw penalties, destructive CTAs |
| **Warn (Orange)** | `--mb-warn` (`#ffa63d`) | `--mb-on-gold` (`#3a2a00`) | Paused match, warning notices |

---

## 3. Typography & Hierarchy

- **Display Font**: `Anybody` (`[font-family:var(--mb-font-display)]`)
  - Used for headings, room codes, card indices, game titles, sticker labels, and button text.
  - Attributes: `font-black`, `uppercase`, `tracking-tight` or `tracking-widest`, often `italic`.
- **Body Font**: `Plus Jakarta Sans` (`[font-family:var(--mb-font-body)]`)
  - Used for descriptions, house rules explanation, player names, and long-form prompts.
  - Never uppercase player-written content or arbitrary user inputs.

### Scale Rules
- **Hero / Room Code**: `text-6xl` to `text-8xl`, `font-black`, `italic`, `uppercase`, `text-[var(--mb-violet)]` or `text-[var(--mb-accent)]` with hard text-shadows (`mb-neon-*`).
- **Section Titles**: `text-2xl` to `text-4xl`, `font-black`, `uppercase`, `-rotate-1` or `-skew-x-6`.
- **Labels / Badges**: `text-xs` to `text-sm`, `font-black`, `uppercase`, `tracking-wider`.

---

## 4. Borders, Shadows & Radii

### Borders
- **Standard**: `border-2 border-black`
- **Thick / Heavy**: `border-[3px] border-black` or `border-4 border-black`
- **Dashed Placeholders**: `border-2 border-dashed border-[var(--mb-line-dim)]`

### Slab Shadows
- **Standard Shadow**: `shadow-[var(--mb-shadow)]` (`4px 4px 0 0 #000`)
- **Large Shadow**: `shadow-[var(--mb-shadow-lg)]` (`8px 8px 0 0 #000`)
- **Small Badge Shadow**: `shadow-[2px_2px_0_0_#000]`
- **Tiny Chip Shadow**: `shadow-[1px_1px_0_0_#000]`
- **Rule**: NO soft radial blurs (`shadow-xl`, `blur-md`). All shadows are solid, un-blurred `#000` slabs.

### Radii Scale
The Tailwind radius scale is globally squashed in `tokens.css` for squarer neo-brutalist plates:
- Small / Medium: `rounded-md` (0.25rem), `rounded-lg` (0.5rem), `rounded-xl`
- Status Dots: `rounded-full` (only for tiny online/turn status dots)

---

## 5. Design System Components (`@merky/ui`)

### `Button`
```tsx
<Button variant="primary" size="lg" block>Create room</Button>
```
- Variants: `primary`, `secondary`, `gold`, `danger`, `ghost`
- Sizes: `lg` (`min-h-14`), `md` (`min-h-12`), `sm` (`min-h-11`)
- Built-in audio click sound (`sfx.play("click")`) and haptic tap (`buzz(10)`).

### `Card` & `Panel`
```tsx
<Card raised className="bg-[var(--mb-surface)]">...</Card>
<Panel className="bg-[var(--mb-surface-2)]">...</Panel>
```
- `Card`: `border-[3px] border-black shadow-[var(--mb-shadow)]` (or `border-4 shadow-[var(--mb-shadow-lg)]` when `raised`)
- `Panel`: `border-2 border-black bg-[var(--mb-surface-2)]`

### `Pill`
```tsx
<Pill tone="accent">Lobby Live</Pill>
```
- `border-2 border-black shadow-[2px_2px_0_0_#000] px-2.5 py-1 text-xs font-extrabold uppercase`

### `PlayerChip` & `WhimsicalPlayerChip`
- Displays avatar face, seat name, host crown (`👑`), connection indicator, and trailing badges with a hard 2px black border.

---

## 6. Motion & FX Kit (`fx.css`)

All animations respect `prefers-reduced-motion` and are frozen when reduced motion is requested.

- **Entrance Effects**: `.mb-pop`, `.mb-rise`, `.mb-drop`, `.mb-flip-in`, `.mb-deal`
- **Staggered Lists**: `.mb-stagger` parent adds incremental delays (`--mb-i`) to children.
- **Hero FX**:
  - `.mb-neon-gold` / `.mb-neon-pink` / `.mb-neon-cyan`: Flat saturated text with hard black double text-shadow.
  - `.mb-wobble` / `.mb-wobble-fast`: Un-hinged skew jitter for hero room codes and stage titles.
  - `.mb-marquee`: Infinite horizontal ticker loop.
  - `.mb-blink`: High-priority alert pulsing.
  - `.mb-press`: Sinks element into offset shadow on click (`active:translate-x-1 active:translate-y-1 active:shadow-none`).
  - `.mb-lift`: Desktop hover sink for cards.

---

## 7. Responsive & Accessibility Standards

1. **Touch Targets**: Mobile controllers must have a minimum touch target height of 44px (`min-h-11` / `min-h-13` / `min-h-14`).
2. **Stage Readability**: Stage TV layouts must read effortlessly at 10 feet distance (use `text-3xl` to `text-8xl`, thick borders, high-contrast text tokens).
3. **Controller Layout**: Controllers must work down to 360px screen width without horizontal overflow.
4. **Screen Readers & ARIA**: Every phase change must update an `aria-live="polite"` region. Interactive buttons must have explicit `aria-label` or visible text.
