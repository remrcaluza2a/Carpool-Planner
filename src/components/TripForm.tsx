import { useState, type FormEvent } from "react";
import type { TripInput } from "../lib/api";
import type { Trip } from "../lib/types";
import { fromLocalInput, toLocalInput } from "../lib/format";

function defaultDepart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toLocalInput(d.toISOString());
}

export function TripForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
}: {
  initial?: Trip;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (input: TripInput) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [destination, setDestination] = useState(initial?.destination ?? "");
  const [meetingPoint, setMeetingPoint] = useState(initial?.meetingPoint ?? "");
  const [departAt, setDepartAt] = useState(initial ? toLocalInput(initial.departAt) : defaultDepart());
  const [returnAt, setReturnAt] = useState(toLocalInput(initial?.returnAt ?? null));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !destination.trim() || !departAt) {
      setError("Give the trip a name, a destination and a departure time.");
      return;
    }
    if (returnAt && new Date(returnAt) < new Date(departAt)) {
      setError("The return time is before departure.");
      return;
    }
    setError("");
    onSubmit({
      title,
      destination,
      meetingPoint,
      departAt: fromLocalInput(departAt)!,
      returnAt: fromLocalInput(returnAt),
      notes,
    });
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className="field">
        <span>Trip name</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Away game at Whitmore" maxLength={80} required />
      </label>
      <label className="field">
        <span>Destination</span>
        <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Whitmore Stadium, Gate C" maxLength={120} required />
      </label>
      <label className="field">
        <span>Meeting point <em>optional</em></span>
        <input value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)} placeholder="Student union bus bay" maxLength={120} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Leaving</span>
          <input type="datetime-local" value={departAt} onChange={(e) => setDepartAt(e.target.value)} required />
        </label>
        <label className="field">
          <span>Back <em>optional</em></span>
          <input type="datetime-local" value={returnAt} onChange={(e) => setReturnAt(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Notes for the group <em>optional</em></span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={600} placeholder="Gas split, what to bring, parking..." />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
