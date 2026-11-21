import { useState, type FormEvent } from "react";
import { Minus, Plus } from "lucide-react";
import type { CarInput } from "../lib/api";
import type { Car } from "../lib/types";

export function SeatStepper({ value, onChange, min = 1, max = 8 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="stepper">
      <button type="button" className="icon-btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="One fewer seat">
        <Minus size={15} />
      </button>
      <span className="mono" aria-live="polite">{value}</span>
      <button type="button" className="icon-btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="One more seat">
        <Plus size={15} />
      </button>
    </div>
  );
}

export function CarForm({
  initial,
  spots,
  busy,
  submitLabel,
  onSubmit,
}: {
  initial?: Car;
  spots: string[];
  busy?: boolean;
  submitLabel: string;
  onSubmit: (input: CarInput) => void;
}) {
  const [driverName, setDriverName] = useState(initial?.driverName ?? "");
  const [vehicle, setVehicle] = useState(initial?.vehicle ?? "");
  const [leavingFrom, setLeavingFrom] = useState(initial?.leavingFrom ?? "");
  const [seats, setSeats] = useState(initial?.seats ?? 4);
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!driverName.trim()) {
      setError("Who's driving?");
      return;
    }
    setError("");
    onSubmit({ driverName, vehicle, leavingFrom, seats });
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className="field">
        <span>Driver</span>
        <input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Ana Petrova" maxLength={60} autoFocus />
      </label>
      <label className="field">
        <span>Car <em>optional</em></span>
        <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Red Corolla, plate ends 4KT" maxLength={60} />
      </label>
      <label className="field">
        <span>Leaving from <em>optional</em></span>
        <input value={leavingFrom} onChange={(e) => setLeavingFrom(e.target.value)} list="spot-options" placeholder="Hartley Hall" maxLength={120} />
        <datalist id="spot-options">{spots.map((s) => <option key={s} value={s} />)}</datalist>
      </label>
      <div className="field field-inline">
        <span>Seats for riders<small className="muted"> (not counting the driver)</small></span>
        <SeatStepper value={seats} onChange={setSeats} />
      </div>
      {initial && seats < initial.seats && (
        <p className="form-note">Riders in removed seats go back to the waitlist.</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Saving..." : submitLabel}</button>
    </form>
  );
}
