# Design System — Stock Peak

## Product Context
- **What this is:** AI-powered daily stock picks platform for Dhaka Stock Exchange (DSE)
- **Who it's for:** Bangladeshi service professionals (doctors, engineers, teachers), 25-45, checking picks on mobile during morning commute
- **Space/industry:** Fintech / stock analysis, competing with StockLens BD
- **Project type:** Web app (responsive, mobile-first) — dashboard + landing page + email/Telegram delivery

## Aesthetic Direction
- **Direction:** Industrial/Editorial — Bloomberg meets The Economist for Bangladesh
- **Decoration level:** Intentional — subtle card elevation, thin dividers, warm paper-like tints. No decorative blobs or gradients-as-brand.
- **Mood:** Serious, trustworthy, information-dense but not cluttered. Like receiving stock analysis from a financial journalist, not a SaaS dashboard.
- **Reference sites:** TradingView (chart UX gold standard), SimplyWall.St (visual financial reports), The Economist (editorial typography)

## Typography
- **Display/Hero:** Fraunces (variable, optical size axis) — Financial authority. Serif signals trust and establishment. `font-variation-settings: 'opsz' 32`
- **Body:** Plus Jakarta Sans — Clean, modern, excellent readability at small sizes. Slightly rounded but professional.
- **Bengali:** Noto Sans Bengali — Best open-source Bengali font. Proper metrics, full character coverage, well-maintained.
- **Data/Tables:** Geist Mono (tabular-nums) — Monospace for price alignment. Clean digit spacing.
- **Code:** Geist Mono
- **Loading:** Google Fonts CDN. `https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap`
- **Scale:** 11px (caption) / 13px (small) / 14px (body) / 16px (large body) / 20px (h3) / 24px (h2) / 32-56px (h1, clamped)

## Color
- **Approach:** Restrained — one accent + warm neutrals. Color is rare and meaningful.
- **Primary:** `#0066CC` — Financial blue. Trust signal. Used for links, CTAs, active states.
- **Primary hover:** `#0052A3`
- **Neutrals (warm slate):**
  - Background: `#F8F6F4`
  - Surface (cards): `#FFFFFF`
  - Border: `#E7E5E4`
  - Border subtle: `#F5F5F4`
  - Text: `#1C1917`
  - Text muted: `#78716C`
- **Semantic:**
  - Success / Stock Up: `#16A34A`
  - Danger / Stock Down: `#DC2626`
  - Warning: `#D97706`
  - Info: `#0284C7`
- **Dark mode:**
  - Background: `#121212`
  - Surface: `#1E1E1E`
  - Border: `#2D2D2D`
  - Text: `#E7E5E4`
  - Text muted: `#A8A29E`
  - Primary: `#3B82F6` (slightly desaturated for dark bg)
  - Success: `#22C55E`, Danger: `#EF4444`

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — not cramped (not a trading terminal) but not wasteful (mobile screen matters)
- **Scale:** xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

## Layout
- **Approach:** Grid-disciplined, mobile-first
- **Grid:** 1 column (mobile), 2 columns (tablet), 3 columns (desktop dashboard)
- **Max content width:** 960px
- **Border radius:** sm: 4px, md: 8px, lg: 12px, full: 9999px (pills/badges)

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms)
- **Price change flash:** 150ms background tint on price update (green for up, red for down)
- **Page transitions:** 200ms fade
- **No:** bouncy animations, scroll-driven spectacles, decorative motion

## Shadows
- **Small:** `0 1px 2px rgba(0,0,0,0.05)` — subtle card hover
- **Medium:** `0 4px 12px rgba(0,0,0,0.08)` — elevated cards, modals
- **Dark mode:** increase opacity to 0.2 / 0.3

## Stock-Specific Patterns
- **Gain/Up:** Always `#16A34A` green, prefix with `+`
- **Loss/Down:** Always `#DC2626` red, prefix with `-`
- **Confidence score:** 1-10 scale. Display as `N/10` with label (1-3: Speculative, 4-6: Moderate, 7-10: High Confidence)
- **Market Mood:** Bullish (green dot + green text), Neutral (gray), Bearish (red dot + red text)
- **Price display:** Always use `font-variant-numeric: tabular-nums` for alignment
- **Bengali content:** Pick reasoning, market mood explanation, and investor education in Bengali. UI labels bilingual.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-06 | Initial design system created | /design-consultation based on product context + competitive research |
| 2026-04-06 | Serif display font (Fraunces) | Editorial authority differentiator vs StockLens BD's generic sans-serif |
| 2026-04-06 | Warm neutrals over cool grays | Target user is a doctor/teacher, not a day trader. Warmth builds comfort. |
| 2026-04-06 | Restrained color approach | Trust through restraint. Blue accent + green/red signals carry all meaning. |
