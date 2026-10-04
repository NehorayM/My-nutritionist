# Design system

Warm, calm and personal — a kitchen notebook, not an analytics dashboard. Oat/cream surfaces, an
evergreen primary, an apricot energy accent and one distinct hue per macronutrient. Styles live in
`src/index.css` (entry + base layer + reduced motion), `src/app/styles/tokens.css` (theme tokens, dark
overrides, shell geometry) and `src/app/styles/utilities.css`; components in `src/components/ui/*` (barrel
`@/components/ui`, which also exports a token-aware `cn`). Features compose these; they do not invent colors, radii or shadows.

## Tokens

Tailwind CSS 4 `@theme` variables, so every token is also a utility (`bg-surface`, `text-protein-ink`,
`rounded-card`, `shadow-card`, …). Dark values override the same variables on
`:root[data-theme="dark"]`; `dark:` variants key on that attribute.

| Token | Use | Light | Dark |
|---|---|---|---|
| `backdrop` | page behind the framed column (≥ sm) | oat `#eee5d8` | near-black green |
| `bg` | app/screen background, sticky headers | cream `#faf6ef` | `#111814` |
| `surface` | cards, sheets, inputs | `#fffdfa` | `#18201c` |
| `surface-2` | tracks, inset areas, segmented control | warm grey-oat | lifted green-grey |
| `border` | hairlines, control borders | | |
| `text` / `text-muted` | body / secondary text (14.6 : 1 and 6.3 : 1 on `bg`) | deep green-ink | warm off-white |
| `primary` (+ `primary-foreground`) | evergreen: main actions, selection, focus accents | `#1d6447` | mint `#7ccfa7` |
| `accent` (+ `accent-foreground`, `accent-ink`) | apricot highlights, eyebrow text | | |
| `success` `warning` `danger` (+ `danger-foreground`) `info` | status; all ≥ 4.9 : 1 on `surface` | | |
| `energy` | calories (apricot-orange) | | |
| `protein` `carbs` `fat` `fiber` | macro hues: indigo, amber, rose, green | | |
| `micro` | micronutrients (teal) | | |
| `ring` | focus outline | | |

**Graphic vs. text colors.** Nutrient hues are *graphic* colors (bars, rings, dots; ≥ 3 : 1 on surface).
For small text in a nutrient color use the `*-ink` variant (`text-carbs-ink`, ≥ 6 : 1), which mixes the hue
toward `text` and works in both themes. Color never carries meaning alone: every bar has a label and a
number, every badge has words.

**Tones.** `components/ui/tones.ts` maps a `Tone` (`neutral | primary | accent | success | warning |
danger | info | energy | protein | carbs | fat | fiber | micro`) to fill, stroke, text and soft (badge)
classes. Use a tone prop (`<ProgressBar tone="protein">`, `<Badge tone="fiber">`) instead of raw classes.

## Typography

Plus Jakarta Sans Variable (self-hosted via `@fontsource-variable/plus-jakarta-sans`, imported in
`main.tsx`). `body` sets `font-variant-numeric: tabular-nums` so kcal, grams and weights never jitter.

| Role | Class | Size / weight |
|---|---|---|
| Hero number (ring center, current weight) | `text-display` / `text-2xl font-extrabold` | 40 px / 24 px |
| Screen title (`<h1>` in `ScreenHeader`) | `text-title font-extrabold` | 28 px, −0.02 em |
| Sheet title | `text-xl font-bold` | 20 px |
| Section heading (`SectionHeader`) | `text-lg font-bold` | 18 px |
| Card title | `text-base font-bold` | 16 px |
| Body / controls | `text-[0.9375rem]` – `text-base` | 15–16 px (inputs are 16 px: no iOS zoom) |
| Secondary | `text-sm text-text-muted` | 14 px |
| Captions, badges | `text-xs font-semibold` | 12 px |
| Eyebrow (date above a title) | `text-xs font-bold uppercase tracking-[0.08em] text-accent-ink` | 12 px |
| Bottom-bar labels | `text-2xs` (11 px) | |

Weights: 500 for long text, 600 for labels, 700 for headings, 800 for screen titles and hero numbers.

## Spacing & layout

- 4 px grid (Tailwind spacing). Screen gutters `px-5` (20 px); card padding `px-5 py-4`; gaps between
  cards `space-y-4`–`space-y-6`.
- **AppShell**: phones get a full-bleed column (`h-dvh`) with the screen scrolling inside `<main>`. From
  `sm` (40 rem) the app sits in a centered **30 rem** frame (`rounded-frame`, `shadow-frame`) on the soft
  `app-backdrop`. Bottom padding of `<main>` clears the nav (`--nav-height` + safe area).
- Safe areas: `viewport-fit=cover` in `index.html`; utilities `pt-safe`, `pb-safe`, `px-safe`.

## Radii & elevation

| Token | px | Use |
|---|---|---|
| `rounded-field` | 14 | inputs, selects, textareas |
| `rounded-card` | 20 | cards, list tiles, toasts |
| `rounded-card-lg` | 24 | dialogs, hero cards |
| `rounded-sheet` | 28 | bottom sheet top corners / desktop panel |
| `rounded-frame` | 36 | desktop device frame |
| `rounded-full` | — | every button, chip, badge, segmented control, progress track |

Shadows are warm-tinted and soft: `shadow-thumb` (controls), `shadow-card` (raised cards),
`shadow-raised` (sheets, dialogs, toasts), `shadow-frame` (desktop frame). Dark mode deepens the tint.
**Blur is used only on the bottom bar** (`bar-surface`: translucent + `backdrop-filter` when supported,
solid `surface` otherwise and under `prefers-reduced-transparency`). Sticky screen headers are solid
`bg`; a hairline edge fades in once the screen scrolls (`scroll-edge`, a scroll-driven animation where
supported, nothing otherwise).

## Components (`@/components/ui`)

| Component | Rules |
|---|---|
| `Button` | Pill. Variants: `primary` (one per view region), `secondary`, `subtle`, `ghost`, `danger` (destructive confirmations only). Sizes `sm` 36 px (44 px hit area), `md` 44 px, `lg` 52 px. `loading` keeps the label, adds a spinner and `aria-busy`, and ignores activation without losing focus. Defaults to `type="button"`. |
| `IconButton` | `label` is required (accessible name + tooltip). Default `ghost`. |
| `Card` (+ `CardHeader` with `action`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) | Variants `raised` (default), `flat`, `outline`, `tinted`. Use `as="section"` + `aria-labelledby` for meal cards. |
| `Badge` | Non-interactive label with a tone (source, diet flag, status). |
| `Chip` / `ToggleChip` | Compact pill actions / on-off filters (`aria-pressed`). |
| `Field` + `Input` / `NumberInput` / `Select` / `Textarea` | Always wrap a control in `Field`: it wires `id`, `htmlFor`, `aria-describedby` (hint + error), `aria-invalid`, `required`, `disabled`. Mark the few optional fields with `optional`. `NumberInput` uses `inputMode="decimal"`, accepts `72,5` and `72.5`, reports `number \| null`; range checks belong to form validation shown via `Field error`. `Select` is native (best mobile pickers). |
| `Switch` | Settings that apply immediately (`role="switch"`). Label is clickable. |
| `SegmentedControl` | 2–5 short exclusive options (chart range, units). Native radios: one tab stop, arrow keys move + select. |
| `Tabs` / `TabList` / `Tab` / `TabPanel` | Switch views inside one surface (Add Food: Recent, Favorites, Saved, Custom). Automatic activation, roving tabindex, Home/End; `keepMounted` preserves form state. |
| `ProgressBar` / `ProgressRing` | Toward a target. `role="progressbar"`; `aria-valuenow` is clamped to the target, so `valueText` must carry the real amount ("2,300 of 2,000 kcal, 300 over"). Visually caps at 100 %: a bar shows the share above the target as a striped tail after a notch, a ring adds a thin overflow lap. **Never red for "over"** — it is information, not an error. Unknown value or target → indeterminate. |
| `Stat` | A labelled number (label first in reading order). Format values with `lib/format`. |
| `SectionHeader` | Heading for a group of cards, optional description and trailing action. |
| `Sheet` | Forms and lists (Add Food, edit entry). Bottom sheet on phones, centered panel ≥ sm. Required `title` (accessible name), optional `description`, close button, scrollable body, sticky `footer` (primary action last). Focus trapped, Escape closes, focus returns to the opener. |
| `Dialog` / `ConfirmDialog` | Short content / confirmations. `ConfirmDialog` is an `alertdialog`, focuses **Cancel** first, no outside-click dismissal, async `onConfirm` shows progress and stays open on failure. Prefer **Undo** toasts over confirmation for easily reversible actions. |
| `EmptyState` | Friendly "nothing here yet" + the next step (one or two actions). |
| `ErrorState` | `role="alert"`, reassuring copy ("Your data is safe"), optional retry. |
| `LoadingState`, `Spinner`, `Skeleton` | Announced status text / decorative spinner (labelled → status) / decorative placeholders. |
| `Toaster` + `notify` | Mount `Toaster` once (App). Features call `notify.success \| info \| error(message, { description, undo, id, duration })` from `@/lib/notify` and never import sonner. Toasts sit above the bottom bar (`--toast-offset`). |

App shell (`src/app`): `AppShell`, `ScreenHeader` (sticky; the screen's only `<h1>`; `eyebrow`, `subtitle`,
`actions`, extra sticky `children` such as a date switcher), `BottomNav` (exactly four tabs: Meals,
Progress, Activity, Profile), `useHashRoute` (`#/meals` default; unknown `#/…` → `#/meals`; non-route
fragments such as auth callbacks and the query string are left untouched), `ScreenErrorBoundary`,
`RoutedApp` (Meals eager; other tabs lazy — Progress carries recharts — with preload on hover/focus).

## Motion

- Short and soft: 150–200 ms for state changes, 260–340 ms for entering screens/sheets, easing
  `ease-out-soft` (`cubic-bezier(0.22, 1, 0.36, 1)`). Keyframes: `fade-in/out`, `sheet-in/out`,
  `pop-in/out`, `screen-in` (`animate-*`).
- `prefers-reduced-motion: reduce` collapses all animations and transitions to ~0 ms globally (and
  components add `motion-reduce:*`). Only elements marked `data-motion="essential"` (spinners) keep a
  slow rotation, because they convey state. JS-driven animation (charts) must check
  `usePrefersReducedMotion()`.

## Accessibility conventions

- Touch targets ≥ 44 × 44 px; smaller visuals use the `hit-area` utility.
- Visible focus everywhere: global `:focus-visible` outline (2 px `ring`, 2 px offset); inputs add a
  soft ring. Never remove outlines without a replacement.
- One `<h1>` per screen (`ScreenHeader`); sections use `h2`, cards `h3`.
- `nav aria-label="Primary"` with `aria-current="page"`; screens are isolated by error boundaries; after a
  tab change focus stays on the activated tab, or moves to `<main>` if it was inside the old screen.
- Icons are decorative (`aria-hidden`) unless they are the only content, in which case use
  `IconButton label`.
- Unknown nutrient values render as "—" (`lib/format`), never as 0; trace amounts as "<1 g".
- Language is neutral and supportive: *current intake, remaining, gap, balance, practical next meal*.
  Never "bad food", "cheat", "failure", "burn off", "earn", "guilt", "compensate". Weight deltas are
  shown with a sign only (`formatWeightDelta`), never framed as good or bad.

## Theming

`useUiStore` (`mn.ui` in localStorage) holds `theme: 'system' | 'light' | 'dark'`. `useApplyTheme()`
(mounted in `App`) resolves `system` through `matchMedia('(prefers-color-scheme: dark)')`, live, and writes
`data-theme` on `<html>` plus `<meta name="theme-color">`. An inline script in `index.html` applies the saved
theme before first paint. `Toaster` follows the resolved theme.
