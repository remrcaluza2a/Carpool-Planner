export interface Trip {
  id: string;
  title: string;
  destination: string;
  meetingPoint: string;
  departAt: string;
  returnAt: string | null;
  notes: string;
  createdAt: string;
}

export interface Car {
  id: number;
  tripId: string;
  driverName: string;
  vehicle: string;
  seats: number;
  leavingFrom: string;
  createdAt: string;
}

export interface Rider {
  id: number;
  tripId: string;
  name: string;
  pickup: string;
  contact: string;
  carId: number | null;
  seatIndex: number | null;
  createdAt: string;
}

export interface TripState {
  trip: Trip;
  cars: Car[];
  riders: Rider[];
}

export interface TripSummary extends Trip {
  carCount: number;
  seatCount: number;
  riderCount: number;
  seatedCount: number;
}
