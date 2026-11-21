# AGENTS.md

Context for AI agents working on Carpool Planner.

## Architecture

- **SPA frontend** (Vite + React + React Router) built to `dist/`. Routes: `/` (landing, create trip, your trips) and `/trips/:id` (the planner).
- **Netlify Server**: `netlify/server/index.ts` is a Hono app (default export) limited to `/api/*` via `export const config`. All API endpoints live here. Don't add Netlify Functions for request handling.
- **Netlify Database** through Drizzle (`drizzle-orm/netlify-db`). `db/schema.ts` is the source of truth, and `db/index.ts` exports `db`.
- `netlify.toml` rewrites only `/trips/*` to `/index.html`. Don't add a catch-all `/*` SPA rewrite because it would capture `/api/*` before the server sees it.

## Key directories

- `src/pages`: `Home.tsx`, `TripPage.tsx` (planner, seating logic, modals), `NotFound.tsx`
- `src/components`: `CarCard` (seat map, drag helpers), `CarForm`, `TripForm`, `Modal` (native `<dialog>`), `Toast`, `Logo`
- `src/lib`: `api.ts` (typed fetch client), `types.ts`, `format.ts`, `recent.ts` (localStorage list of trip ids)
- `db/`: Drizzle schema and client. `netlify/database/migrations/` holds generated migrations.
- `public/img/hero.png`: generated hero art, always referenced via `/.netlify/images?url=/img/hero.png&...`

## Data model and non-obvious decisions

- **No accounts.** A trip id is a random 12-character slug, and the link works as the access key. Every car and rider route is nested under `/api/trips/:id/...` and checks that the record belongs to that trip.
- `cars.seats` counts **passenger** seats (the driver is not included), from 1 to 8.
- A rider is on the waitlist when `car_id` and `seat_index` are null. A unique index on `(car_id, seat_index)` prevents two riders sharing a seat.
- Seat moves go through `PATCH /api/trips/:id/riders/:riderId` with `{carId, seatIndex}`. If the seat is taken, the server swaps the two riders, or sends the occupant to the waitlist when the mover came from the waitlist. `moveLocally` in `TripPage.tsx` mirrors this for the instant UI update, so keep them in sync.
- Shrinking a car's seats or deleting a car moves the affected riders back to the waitlist.
- Every mutation returns the full trip state (`{trip, cars, riders}`), and the client replaces its state with it. The trip page polls every 12s when no mutation is in flight.

## Conventions

- TypeScript everywhere. Server imports use `.js` extensions (`../../db/index.js`).
- Styling is plain CSS in `src/styles.css` with CSS variables (paper, ink, tomato, mustard, teal). Per-car accent colors come from `.tone-*` classes chosen by `carTone(index)`.
- UI copy is concrete and student-oriented. Don't use emojis in UI text.
- Schema changes: edit `db/schema.ts`, then run `npx drizzle-kit generate --name <snake_case_change>`. Never hand-edit applied migrations, and never run migrate or push.
