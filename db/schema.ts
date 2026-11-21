import { pgTable, serial, text, timestamp, integer, uniqueIndex, index } from "drizzle-orm/pg-core";

// A trip is identified by an unguessable slug. Anyone holding the link can plan it,
// which is how students share a trip with their group without creating accounts.
export const trips = pgTable("trips", {
  id: text().primaryKey(),
  title: text().notNull(),
  destination: text().notNull(),
  meetingPoint: text("meeting_point").notNull().default(""),
  departAt: timestamp("depart_at", { withTimezone: true }).notNull(),
  returnAt: timestamp("return_at", { withTimezone: true }),
  notes: text().notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A car offered by a driver. `seats` counts passenger seats (the driver is not included).
export const cars = pgTable(
  "cars",
  {
    id: serial().primaryKey(),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    driverName: text("driver_name").notNull(),
    vehicle: text().notNull().default(""),
    seats: integer().notNull(),
    leavingFrom: text("leaving_from").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cars_trip_idx").on(t.tripId)],
);

// A rider who needs a seat. carId/seatIndex are null while they are on the waitlist.
export const riders = pgTable(
  "riders",
  {
    id: serial().primaryKey(),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    name: text().notNull(),
    pickup: text().notNull().default(""),
    contact: text().notNull().default(""),
    carId: integer("car_id").references(() => cars.id, { onDelete: "set null" }),
    seatIndex: integer("seat_index"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("riders_trip_idx").on(t.tripId),
    uniqueIndex("riders_car_seat_unique").on(t.carId, t.seatIndex),
  ],
);
