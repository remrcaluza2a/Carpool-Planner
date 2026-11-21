import { Hono } from "hono";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { cars, riders, trips } from "../../db/schema.js";

export const config = { path: "/api/*" };

const app = new Hono().basePath("/api");

type Body = Record<string, unknown>;

class InputError extends Error {}

const MAX_SEATS = 8;
const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function newTripId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
}

function text(body: Body, key: string, max: number, required = false): string {
  const raw = body[key];
  const value = typeof raw === "string" ? raw.trim() : "";
  if (required && !value) throw new InputError(`${key} is required`);
  if (value.length > max) throw new InputError(`${key} must be ${max} characters or fewer`);
  return value;
}

function date(body: Body, key: string, required = false): Date | null {
  const raw = body[key];
  if (raw === null || raw === undefined || raw === "") {
    if (required) throw new InputError(`${key} is required`);
    return null;
  }
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) throw new InputError(`${key} is not a valid date`);
  return d;
}

function seatCount(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_SEATS) {
    throw new InputError(`Seats must be a whole number from 1 to ${MAX_SEATS}`);
  }
  return n;
}

async function readBody(req: Request): Promise<Body> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Body) : {};
  } catch {
    return {};
  }
}

async function loadTrip(id: string) {
  const [trip] = await db.select().from(trips).where(eq(trips.id, id));
  if (!trip) return null;
  const [carRows, riderRows] = await Promise.all([
    db.select().from(cars).where(eq(cars.tripId, id)).orderBy(asc(cars.createdAt), asc(cars.id)),
    db.select().from(riders).where(eq(riders.tripId, id)).orderBy(asc(riders.createdAt), asc(riders.id)),
  ]);
  return { trip, cars: carRows, riders: riderRows };
}

async function tripExists(id: string) {
  const [row] = await db.select({ id: trips.id }).from(trips).where(eq(trips.id, id));
  return Boolean(row);
}

async function respondWithTrip(c: any, id: string, status: 200 | 201 = 200) {
  const full = await loadTrip(id);
  if (!full) return c.json({ error: "Trip not found" }, 404);
  return c.json(full, status);
}

app.onError((err, c) => {
  if (err instanceof InputError) return c.json({ error: err.message }, 400);
  console.error(err);
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});

// ---- Trips ---------------------------------------------------------------

app.get("/trips", async (c) => {
  const ids = (c.req.query("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
  if (ids.length === 0) return c.json({ trips: [] });

  const [tripRows, carRows, riderRows] = await Promise.all([
    db.select().from(trips).where(inArray(trips.id, ids)),
    db.select().from(cars).where(inArray(cars.tripId, ids)),
    db.select().from(riders).where(inArray(riders.tripId, ids)),
  ]);

  const summaries = tripRows.map((trip) => {
    const tripCars = carRows.filter((car) => car.tripId === trip.id);
    const tripRiders = riderRows.filter((r) => r.tripId === trip.id);
    return {
      ...trip,
      carCount: tripCars.length,
      seatCount: tripCars.reduce((sum, car) => sum + car.seats, 0),
      riderCount: tripRiders.length,
      seatedCount: tripRiders.filter((r) => r.carId !== null).length,
    };
  });
  return c.json({ trips: summaries });
});

app.post("/trips", async (c) => {
  const body = await readBody(c.req.raw);
  const id = newTripId();
  await db.insert(trips).values({
    id,
    title: text(body, "title", 80, true),
    destination: text(body, "destination", 120, true),
    meetingPoint: text(body, "meetingPoint", 120),
    departAt: date(body, "departAt", true)!,
    returnAt: date(body, "returnAt"),
    notes: text(body, "notes", 600),
  });
  return respondWithTrip(c, id, 201);
});

// Creates a ready-made trip so first-time visitors can try the planner instantly.
app.post("/trips/sample", async (c) => {
  const id = newTripId();
  const depart = new Date();
  depart.setDate(depart.getDate() + ((5 - depart.getDay() + 7) % 7 || 7));
  depart.setHours(16, 30, 0, 0);
  const ret = new Date(depart);
  ret.setDate(ret.getDate() + 2);
  ret.setHours(14, 0, 0, 0);

  await db.insert(trips).values({
    id,
    title: "Lake Wendell weekend",
    destination: "Pinecrest Cabins, Lake Wendell",
    meetingPoint: "Library loop, north entrance",
    departAt: depart,
    returnAt: ret,
    notes: "Bring sleeping bags. Gas split is $14 each, pay your driver on Venmo.",
  });
  const [maya, theo, priya] = await db
    .insert(cars)
    .values([
      { tripId: id, driverName: "Maya Okafor", vehicle: "Blue 2014 Civic", seats: 4, leavingFrom: "Hartley Hall" },
      { tripId: id, driverName: "Theo Brandt", vehicle: "Silver Sienna", seats: 6, leavingFrom: "Library loop" },
      { tripId: id, driverName: "Priya Raman", vehicle: "Green Outback", seats: 3, leavingFrom: "Elm St. apartments" },
    ])
    .returning();
  await db.insert(riders).values([
    { tripId: id, name: "Jonah Weiss", pickup: "Hartley Hall", carId: maya.id, seatIndex: 0 },
    { tripId: id, name: "Lucía Ferraro", pickup: "Hartley Hall", carId: maya.id, seatIndex: 1 },
    { tripId: id, name: "Dev Kulkarni", pickup: "Library loop", carId: theo.id, seatIndex: 0 },
    { tripId: id, name: "Hana Sato", pickup: "Library loop", carId: theo.id, seatIndex: 2 },
    { tripId: id, name: "Marcus Bell", pickup: "Library loop", carId: theo.id, seatIndex: 3 },
    { tripId: id, name: "Ines Moreau", pickup: "Elm St. apartments", carId: priya.id, seatIndex: 0 },
    { tripId: id, name: "Sam Achebe", pickup: "Hartley Hall" },
    { tripId: id, name: "Rosa Lindqvist", pickup: "Elm St. apartments" },
    { tripId: id, name: "Kai Nakamura", pickup: "Library loop" },
  ]);
  return respondWithTrip(c, id, 201);
});

app.get("/trips/:id", (c) => respondWithTrip(c, c.req.param("id")));

app.patch("/trips/:id", async (c) => {
  const id = c.req.param("id");
  if (!(await tripExists(id))) return c.json({ error: "Trip not found" }, 404);
  const body = await readBody(c.req.raw);
  const patch: Partial<typeof trips.$inferInsert> = {};
  if ("title" in body) patch.title = text(body, "title", 80, true);
  if ("destination" in body) patch.destination = text(body, "destination", 120, true);
  if ("meetingPoint" in body) patch.meetingPoint = text(body, "meetingPoint", 120);
  if ("departAt" in body) patch.departAt = date(body, "departAt", true)!;
  if ("returnAt" in body) patch.returnAt = date(body, "returnAt");
  if ("notes" in body) patch.notes = text(body, "notes", 600);
  if (Object.keys(patch).length > 0) await db.update(trips).set(patch).where(eq(trips.id, id));
  return respondWithTrip(c, id);
});

app.delete("/trips/:id", async (c) => {
  await db.delete(trips).where(eq(trips.id, c.req.param("id")));
  return c.json({ ok: true });
});

// ---- Cars ----------------------------------------------------------------

app.post("/trips/:id/cars", async (c) => {
  const tripId = c.req.param("id");
  if (!(await tripExists(tripId))) return c.json({ error: "Trip not found" }, 404);
  const body = await readBody(c.req.raw);
  await db.insert(cars).values({
    tripId,
    driverName: text(body, "driverName", 60, true),
    vehicle: text(body, "vehicle", 60),
    leavingFrom: text(body, "leavingFrom", 120),
    seats: seatCount(body.seats),
  });
  return respondWithTrip(c, tripId, 201);
});

app.patch("/trips/:id/cars/:carId", async (c) => {
  const tripId = c.req.param("id");
  const carId = Number(c.req.param("carId"));
  const [car] = await db.select().from(cars).where(and(eq(cars.id, carId), eq(cars.tripId, tripId)));
  if (!car) return c.json({ error: "Car not found" }, 404);

  const body = await readBody(c.req.raw);
  const patch: Partial<typeof cars.$inferInsert> = {};
  if ("driverName" in body) patch.driverName = text(body, "driverName", 60, true);
  if ("vehicle" in body) patch.vehicle = text(body, "vehicle", 60);
  if ("leavingFrom" in body) patch.leavingFrom = text(body, "leavingFrom", 120);
  if ("seats" in body) patch.seats = seatCount(body.seats);

  if (patch.seats !== undefined && patch.seats < car.seats) {
    // Riders sitting in seats that no longer exist go back to the waitlist.
    const seated = await db.select().from(riders).where(eq(riders.carId, carId));
    const bumped = seated.filter((r) => (r.seatIndex ?? 0) >= patch.seats!).map((r) => r.id);
    if (bumped.length) {
      await db.update(riders).set({ carId: null, seatIndex: null }).where(inArray(riders.id, bumped));
    }
  }
  if (Object.keys(patch).length > 0) await db.update(cars).set(patch).where(eq(cars.id, carId));
  return respondWithTrip(c, tripId);
});

app.delete("/trips/:id/cars/:carId", async (c) => {
  const tripId = c.req.param("id");
  const carId = Number(c.req.param("carId"));
  const [car] = await db.select().from(cars).where(and(eq(cars.id, carId), eq(cars.tripId, tripId)));
  if (!car) return c.json({ error: "Car not found" }, 404);
  await db.update(riders).set({ carId: null, seatIndex: null }).where(eq(riders.carId, carId));
  await db.delete(cars).where(eq(cars.id, carId));
  return respondWithTrip(c, tripId);
});

// ---- Riders --------------------------------------------------------------

app.post("/trips/:id/riders", async (c) => {
  const tripId = c.req.param("id");
  if (!(await tripExists(tripId))) return c.json({ error: "Trip not found" }, 404);
  const body = await readBody(c.req.raw);
  await db.insert(riders).values({
    tripId,
    name: text(body, "name", 60, true),
    pickup: text(body, "pickup", 120),
    contact: text(body, "contact", 80),
  });
  return respondWithTrip(c, tripId, 201);
});

app.patch("/trips/:id/riders/:riderId", async (c) => {
  const tripId = c.req.param("id");
  const riderId = Number(c.req.param("riderId"));
  const [rider] = await db.select().from(riders).where(and(eq(riders.id, riderId), eq(riders.tripId, tripId)));
  if (!rider) return c.json({ error: "Rider not found" }, 404);

  const body = await readBody(c.req.raw);
  const patch: Partial<typeof riders.$inferInsert> = {};
  if ("name" in body) patch.name = text(body, "name", 60, true);
  if ("pickup" in body) patch.pickup = text(body, "pickup", 120);
  if ("contact" in body) patch.contact = text(body, "contact", 80);
  if (Object.keys(patch).length > 0) await db.update(riders).set(patch).where(eq(riders.id, riderId));

  if ("carId" in body) {
    if (body.carId === null) {
      await db.update(riders).set({ carId: null, seatIndex: null }).where(eq(riders.id, riderId));
    } else {
      const carId = Number(body.carId);
      const seatIndex = Number(body.seatIndex);
      const [car] = await db.select().from(cars).where(and(eq(cars.id, carId), eq(cars.tripId, tripId)));
      if (!car) throw new InputError("That car is not part of this trip");
      if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= car.seats) {
        throw new InputError("That seat does not exist");
      }
      const [occupant] = await db
        .select()
        .from(riders)
        .where(and(eq(riders.carId, carId), eq(riders.seatIndex, seatIndex)));

      if (!occupant || occupant.id !== riderId) {
        // Free the target seat first, then seat the rider, then give the occupant
        // the rider's old seat (a swap) or send them to the waitlist.
        if (occupant) {
          await db.update(riders).set({ carId: null, seatIndex: null }).where(eq(riders.id, occupant.id));
        }
        await db.update(riders).set({ carId, seatIndex }).where(eq(riders.id, riderId));
        if (occupant && rider.carId !== null && rider.seatIndex !== null) {
          await db
            .update(riders)
            .set({ carId: rider.carId, seatIndex: rider.seatIndex })
            .where(eq(riders.id, occupant.id));
        }
      }
    }
  }
  return respondWithTrip(c, tripId);
});

app.delete("/trips/:id/riders/:riderId", async (c) => {
  const tripId = c.req.param("id");
  await db
    .delete(riders)
    .where(and(eq(riders.id, Number(c.req.param("riderId"))), eq(riders.tripId, tripId)));
  return respondWithTrip(c, tripId);
});

// ---- Seating helpers -----------------------------------------------------

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Seats everyone on the waitlist, keeping riders who share a pickup spot together
// and preferring drivers who leave from (or already carry people from) that spot.
app.post("/trips/:id/auto-assign", async (c) => {
  const tripId = c.req.param("id");
  const full = await loadTrip(tripId);
  if (!full) return c.json({ error: "Trip not found" }, 404);

  const state = full.cars.map((car) => {
    const taken = new Set(
      full.riders.filter((r) => r.carId === car.id && r.seatIndex !== null).map((r) => r.seatIndex!),
    );
    const spots = new Set(full.riders.filter((r) => r.carId === car.id).map((r) => norm(r.pickup)));
    if (car.leavingFrom) spots.add(norm(car.leavingFrom));
    return { car, taken, spots };
  });
  const free = (s: (typeof state)[number]) => s.car.seats - s.taken.size;

  const waiting = full.riders.filter((r) => r.carId === null);
  const groups = new Map<string, typeof waiting>();
  for (const r of waiting) {
    const key = norm(r.pickup);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  const moves: { id: number; carId: number; seatIndex: number }[] = [];
  for (const [spot, group] of ordered) {
    for (const rider of group) {
      const open = state.filter((s) => free(s) > 0);
      if (open.length === 0) break;
      const target =
        (spot && open.filter((s) => s.spots.has(spot)).sort((a, b) => free(b) - free(a))[0]) ||
        open.sort((a, b) => free(b) - free(a))[0];
      let seat = 0;
      while (target.taken.has(seat)) seat++;
      target.taken.add(seat);
      if (spot) target.spots.add(spot);
      moves.push({ id: rider.id, carId: target.car.id, seatIndex: seat });
    }
  }

  for (const m of moves) {
    await db
      .update(riders)
      .set({ carId: m.carId, seatIndex: m.seatIndex })
      .where(and(eq(riders.id, m.id), isNull(riders.carId)));
  }
  return respondWithTrip(c, tripId);
});

app.post("/trips/:id/clear-seats", async (c) => {
  const tripId = c.req.param("id");
  await db.update(riders).set({ carId: null, seatIndex: null }).where(eq(riders.tripId, tripId));
  return respondWithTrip(c, tripId);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
