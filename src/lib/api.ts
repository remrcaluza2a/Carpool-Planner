import type { TripState, TripSummary } from "./types";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export interface TripInput {
  title: string;
  destination: string;
  meetingPoint: string;
  departAt: string;
  returnAt: string | null;
  notes: string;
}

export interface CarInput {
  driverName: string;
  vehicle: string;
  seats: number;
  leavingFrom: string;
}

export interface RiderInput {
  name: string;
  pickup: string;
  contact: string;
}

export const api = {
  listTrips: (ids: string[]) =>
    request<{ trips: TripSummary[] }>(`/trips?ids=${encodeURIComponent(ids.join(","))}`),
  createTrip: (input: TripInput) => request<TripState>("/trips", { method: "POST", body: input }),
  createSample: () => request<TripState>("/trips/sample", { method: "POST", body: {} }),
  getTrip: (id: string) => request<TripState>(`/trips/${id}`),
  updateTrip: (id: string, input: Partial<TripInput>) =>
    request<TripState>(`/trips/${id}`, { method: "PATCH", body: input }),
  deleteTrip: (id: string) => request<{ ok: true }>(`/trips/${id}`, { method: "DELETE" }),

  addCar: (id: string, input: CarInput) => request<TripState>(`/trips/${id}/cars`, { method: "POST", body: input }),
  updateCar: (id: string, carId: number, input: Partial<CarInput>) =>
    request<TripState>(`/trips/${id}/cars/${carId}`, { method: "PATCH", body: input }),
  deleteCar: (id: string, carId: number) => request<TripState>(`/trips/${id}/cars/${carId}`, { method: "DELETE" }),

  addRider: (id: string, input: RiderInput) =>
    request<TripState>(`/trips/${id}/riders`, { method: "POST", body: input }),
  seatRider: (id: string, riderId: number, carId: number | null, seatIndex: number | null) =>
    request<TripState>(`/trips/${id}/riders/${riderId}`, { method: "PATCH", body: { carId, seatIndex } }),
  deleteRider: (id: string, riderId: number) =>
    request<TripState>(`/trips/${id}/riders/${riderId}`, { method: "DELETE" }),

  autoAssign: (id: string) => request<TripState>(`/trips/${id}/auto-assign`, { method: "POST", body: {} }),
  clearSeats: (id: string) => request<TripState>(`/trips/${id}/clear-seats`, { method: "POST", body: {} }),
};
