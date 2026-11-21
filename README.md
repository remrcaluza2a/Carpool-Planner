# Carpool Planner

Carpool Planner helps students organize shared rides for road trips, away games, airport runs, and weekend getaways. Someone creates a trip, drivers add their cars and how many seats they can spare, riders join a waitlist with their pickup spot, and the group drops everyone into seats. The whole plan lives behind one shareable link, so there are no accounts to create.

## Features

- **Trips**: name, destination, meeting point, departure and return times, and notes for the group.
- **Cars and seats**: each driver's car is drawn as a top-down seat map. Seats can be added or removed, and riders in removed seats go back to the waitlist.
- **Riders**: a waitlist of everyone who still needs a seat, each with an optional pickup spot and contact.
- **Seating**: tap a rider and then a seat, or drag and drop on desktop. Tapping an occupied seat swaps the two riders. Tapping an empty seat with nobody selected opens a picker.
- **Auto-fill**: seats everyone on the waitlist and keeps riders who share a pickup spot in the same car, preferring drivers leaving from that spot.
- **Share & copy plan**: share the trip link, or copy a plain-text roster ready to paste in the group chat.
- **Your trips**: the browser remembers trips you've created or opened. A sample trip is one click away.
- **Live-ish sync**: the trip page refreshes every few seconds so friends editing the same link stay in sync.

## Tech

- **Frontend**: React 19, React Router, and Vite, with hand-written CSS and lucide icons.
- **API**: [Hono](https://hono.dev) running as a Netlify Server (`netlify/server/index.ts`) on `/api/*`.
- **Data**: Netlify Database (managed Postgres) through Drizzle ORM. The schema is in `db/schema.ts` and migrations are in `netlify/database/migrations/`.
- **Images**: the hero illustration is served through the Netlify Image CDN.

## Running locally

```bash
npm install
netlify dev --port 8889
```

`netlify dev` runs the Vite dev server together with the Netlify Server API and a local Netlify Database.

After changing `db/schema.ts`, generate a migration:

```bash
npx drizzle-kit generate --name <describe_the_change>
```

Netlify applies migrations automatically on deploy.

## Ideas for later

- Optional organizer passcode so only some people can edit a trip
- Rider self-signup: a "join this trip" view where riders add themselves
- Gas or cost split per car
- Return-trip seating that differs from the way out

https://6afefc673500c56216cee2bd--carpool-planner-f8c738.netlify.app
