# Stock Peak — Next.js App

AI-powered daily stock picks platform for the Dhaka Stock Exchange (DSE). This directory is the Next.js 16 frontend + API layer. The Python pipeline lives in `../scripts/`, the database schema in `./schema-*.sql`, and the single-container deploy wires them together via `../docker-compose.yml`.

## Tiers

- **Entry ৳260/mo** — 3 daily picks, portfolio P&L, stock search + charts, notifications.
- **Analyst ৳550/mo** — everything in Entry + DSE-wide rankings + per-stock AI analysis + trade plan with stop-loss ladder + position sizing.

## Layout

- `src/app/` — App Router pages + API routes
- `src/components/` — shared UI (notably `analysis-panel.tsx` for the Analyst trade-plan view)
- `src/lib/` — server helpers: `access.ts` (tier gating), `indicators.ts` (RSI/MACD/ATR/etc.), `trade-plan.ts` (ATR-based entry/target/stop + ladder), `postgres.ts`, `auth.ts`
- `schema-*.sql` — ordered migrations applied by the container entrypoint on first boot

## Dev

```bash
npm install
npm run dev       # http://localhost:3000 (or 3001 if the prod container is running)
```

Requires a reachable `DATABASE_URL` and `NEXTAUTH_SECRET`. See `.env.example`.

## Project docs

- Root: `../CLAUDE.md`, `../FEATURES.md`, `../TODO.md`, `../DESIGN.md`
- Architecture + vision: `../docs/00-index.md` and siblings

## Upstream framework notes

See `./AGENTS.md` — Next.js 16 ships breaking changes from earlier versions. Check `node_modules/next/dist/docs/` before leaning on training-data defaults.
