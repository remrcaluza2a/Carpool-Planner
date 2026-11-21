import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, CalendarClock, CarFront, ClipboardCopy, Flag, Link2, MapPin, Pencil, Plus,
  RotateCcw, Trash2, Undo2, UserMinus, Wand2, X,
} from "lucide-react";
import { api, ApiError, type CarInput, type RiderInput, type TripInput } from "../lib/api";
import { forgetTrip, rememberTrip } from "../lib/recent";
import { carTone, firstName, formatDay, formatTime, formatWhen, initials, relativeDays } from "../lib/format";
import type { Car, Rider, TripState } from "../lib/types";
import { CarCard, readDraggedRider, startRiderDrag } from "../components/CarCard";
import { CarForm } from "../components/CarForm";
import { Modal } from "../components/Modal";
import { TripForm } from "../components/TripForm";
import { Logo } from "../components/Logo";
import { useToast } from "../components/Toast";
import { NotFound } from "./NotFound";

// Mirrors the server's seat move (including swaps) so the UI responds instantly.
function moveLocally(state: TripState, riderId: number, carId: number | null, seatIndex: number | null): TripState {
  const rider = state.riders.find((r) => r.id === riderId);
  if (!rider) return state;
  const occupant =
    carId === null ? undefined : state.riders.find((r) => r.carId === carId && r.seatIndex === seatIndex && r.id !== riderId);
  return {
    ...state,
    riders: state.riders.map((r) => {
      if (r.id === riderId) return { ...r, carId, seatIndex };
      if (occupant && r.id === occupant.id) return { ...r, carId: rider.carId, seatIndex: rider.seatIndex };
      return r;
    }),
  };
}

function buildPlanText(state: TripState) {
  const { trip, cars, riders } = state;
  const lines = [`${trip.title}: ${trip.destination}`, `Leaving ${formatWhen(trip.departAt)}`];
  if (trip.meetingPoint) lines.push(`Meet at ${trip.meetingPoint}`);
  if (trip.returnAt) lines.push(`Back ${formatWhen(trip.returnAt)}`);
  lines.push("");
  for (const car of cars) {
    const seated = riders.filter((r) => r.carId === car.id).sort((a, b) => a.seatIndex! - b.seatIndex!);
    const head = [car.driverName, car.vehicle && `(${car.vehicle})`, car.leavingFrom && `from ${car.leavingFrom}`]
      .filter(Boolean)
      .join(" ");
    lines.push(`${head}: ${seated.length}/${car.seats} seats`);
    seated.forEach((r) => lines.push(`  - ${r.name}${r.pickup ? ` (${r.pickup})` : ""}`));
    if (seated.length < car.seats) lines.push(`  - ${car.seats - seated.length} open`);
    lines.push("");
  }
  const waiting = riders.filter((r) => r.carId === null);
  if (waiting.length) lines.push(`Still need a ride: ${waiting.map((r) => r.name).join(", ")}`, "");
  if (trip.notes) lines.push(trip.notes, "");
  lines.push(window.location.href);
  return lines.join("\n");
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

type Dialog = { kind: "edit-trip" } | { kind: "add-car" } | { kind: "edit-car"; car: Car } | { kind: "pick"; car: Car; seat: number } | { kind: "delete-trip" } | null;

export function TripPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [state, setState] = useState<TripState | null>(null);
  const [missing, setMissing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [waitOver, setWaitOver] = useState(false);
  const inflight = useRef(0);

  const load = useCallback(async () => {
    try {
      const next = await api.getTrip(id);
      if (inflight.current === 0) setState(next);
      rememberTrip(id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        forgetTrip(id);
        setMissing(true);
      }
    }
  }, [id]);

  useEffect(() => {
    setState(null);
    setMissing(false);
    load();
  }, [load]);

  // Light polling so the plan stays in sync while friends edit the same link.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden && inflight.current === 0) load();
    }, 12000);
    const onFocus = () => inflight.current === 0 && load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelectedId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function run(action: () => Promise<TripState>, success?: string, optimistic?: TripState) {
    inflight.current++;
    if (optimistic) setState(optimistic);
    try {
      const next = await action();
      setState(next);
      if (success) toast(success);
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      // Roll back to the server's copy; load() resolves after the finally below runs.
      if (optimistic) load();
      return false;
    } finally {
      inflight.current--;
    }
  }

  const seatRider = (riderId: number, carId: number | null, seatIndex: number | null) => {
    if (!state) return;
    setSelectedId(null);
    const rider = state.riders.find((r) => r.id === riderId);
    if (!rider || (rider.carId === carId && rider.seatIndex === seatIndex)) return;
    run(() => api.seatRider(id, riderId, carId, seatIndex), undefined, moveLocally(state, riderId, carId, seatIndex));
  };

  const derived = useMemo(() => {
    if (!state) return null;
    const offered = state.cars.reduce((s, c) => s + c.seats, 0);
    const waiting = state.riders.filter((r) => r.carId === null);
    const seated = state.riders.length - waiting.length;
    const spots = new Set<string>();
    if (state.trip.meetingPoint) spots.add(state.trip.meetingPoint);
    state.cars.forEach((c) => c.leavingFrom && spots.add(c.leavingFrom));
    state.riders.forEach((r) => r.pickup && spots.add(r.pickup));
    return { offered, waiting, seated, open: offered - seated, spots: [...spots] };
  }, [state]);

  if (missing) return <NotFound message="We couldn't find that trip." />;
  if (!state || !derived) return <TripSkeleton />;

  const { trip, cars, riders } = state;
  const { offered, waiting, seated, open, spots } = derived;
  const selected = riders.find((r) => r.id === selectedId) ?? null;
  const fillPct = offered ? Math.round((seated / offered) * 100) : 0;

  let status: { tone: string; text: string };
  if (cars.length === 0) status = { tone: "idle", text: "Add the first car to start filling seats." };
  else if (riders.length === 0) status = { tone: "idle", text: `${offered} seats ready. Add riders to the waitlist.` };
  else if (waiting.length === 0) status = { tone: "ok", text: "Everyone has a seat. Copy the plan to the group chat." };
  else if (waiting.length > open)
    status = { tone: "warn", text: `${waiting.length - open} short. You need another car or more seats.` };
  else status = { tone: "info", text: `${waiting.length} waiting and ${open} open seats. Auto-fill can seat everyone.` };

  const onSeat = (car: Car, seatIndex: number, occupant: Rider | undefined) => {
    if (selected) {
      if (occupant?.id === selected.id) setSelectedId(null);
      else seatRider(selected.id, car.id, seatIndex);
      return;
    }
    if (occupant) setSelectedId(occupant.id);
    else if (waiting.length) setDialog({ kind: "pick", car, seat: seatIndex });
    else toast("Nobody is waiting. Add a rider first.", "error");
  };

  const onWaitlistDrop = (e: DragEvent) => {
    e.preventDefault();
    setWaitOver(false);
    const riderId = readDraggedRider(e);
    if (riderId !== null) seatRider(riderId, null, null);
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.title, text: `Grab a seat for ${trip.title}`, url });
        return;
      } catch {
        /* user dismissed; fall back to copying */
      }
    }
    toast((await copyText(url)) ? "Trip link copied" : "Couldn't copy. Copy the address bar instead.", "ok");
  };

  const copyPlan = async () => {
    toast((await copyText(buildPlanText(state))) ? "Plan copied, paste it in the group chat" : "Couldn't copy the plan", "ok");
  };

  const submitCar = async (input: CarInput) => {
    setBusy(true);
    const editing = dialog?.kind === "edit-car" ? dialog.car : null;
    const ok = await run(
      () => (editing ? api.updateCar(id, editing.id, input) : api.addCar(id, input)),
      editing ? "Car updated" : `${firstName(input.driverName)}'s car added`,
    );
    setBusy(false);
    if (ok) setDialog(null);
  };

  const submitTrip = async (input: TripInput) => {
    setBusy(true);
    const ok = await run(() => api.updateTrip(id, input), "Trip details saved");
    setBusy(false);
    if (ok) setDialog(null);
  };

  const deleteTrip = async () => {
    setBusy(true);
    try {
      await api.deleteTrip(id);
      forgetTrip(id);
      toast("Trip deleted");
      navigate("/");
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  };

  const departed = new Date(trip.departAt) < new Date();

  return (
    <div className={`page trip-page${selected ? " is-placing" : ""}`}>
      <header className="topbar">
        <Logo />
        <Link to="/" className="btn btn-ghost btn-sm"><ArrowLeft size={15} /> All trips</Link>
      </header>

      <section className="ticket rise">
        <div className="ticket-main">
          <p className="eyebrow">{departed ? "Departed" : relativeDays(trip.departAt)}</p>
          <h1>{trip.title}</h1>
          <p className="ticket-dest"><Flag size={16} /> {trip.destination}</p>
          <dl className="ticket-facts">
            <div><dt><CalendarClock size={14} /> Leaving</dt><dd>{formatDay(trip.departAt)}<b>{formatTime(trip.departAt)}</b></dd></div>
            {trip.returnAt && <div><dt><RotateCcw size={14} /> Back</dt><dd>{formatDay(trip.returnAt)}<b>{formatTime(trip.returnAt)}</b></dd></div>}
            {trip.meetingPoint && <div><dt><MapPin size={14} /> Meet at</dt><dd>{trip.meetingPoint}</dd></div>}
          </dl>
          {trip.notes && <p className="ticket-notes">{trip.notes}</p>}
          <div className="ticket-actions">
            <button className="btn btn-primary btn-sm" onClick={share}><Link2 size={15} /> Share link</button>
            <button className="btn btn-outline btn-sm" onClick={copyPlan}><ClipboardCopy size={15} /> Copy plan</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setDialog({ kind: "edit-trip" })}><Pencil size={15} /> Edit</button>
            <button className="btn btn-ghost btn-sm danger" onClick={() => setDialog({ kind: "delete-trip" })}><Trash2 size={15} /> Delete</button>
          </div>
        </div>
        <aside className="ticket-stub">
          <div className="gauge" style={{ ["--pct" as string]: `${fillPct}` }}>
            <span className="mono">{seated}<small>/{offered}</small></span>
            <small>seats filled</small>
          </div>
          <ul className="stub-stats">
            <li><b>{cars.length}</b> {cars.length === 1 ? "car" : "cars"}</li>
            <li><b>{riders.length}</b> riders</li>
            <li className={waiting.length ? "warn" : ""}><b>{waiting.length}</b> waiting</li>
            <li><b>{Math.max(open, 0)}</b> open</li>
          </ul>
        </aside>
      </section>

      <p className={`status status-${status.tone}`} role="status">{status.text}</p>

      <div className="planner">
        <section className="fleet" aria-label="Cars">
          <div className="section-head">
            <h2>Cars <span className="count">{cars.length}</span></h2>
            <div className="section-actions">
              {seated > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => run(() => api.clearSeats(id), "Everyone moved to the waitlist")}>
                  <Undo2 size={15} /> Clear seats
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => setDialog({ kind: "add-car" })}>
                <Plus size={15} /> Add car
              </button>
            </div>
          </div>

          <div className="car-grid">
            {cars.map((car, i) => (
              <CarCard
                key={car.id}
                car={car}
                tone={carTone(i)}
                delay={i * 70}
                riders={riders.filter((r) => r.carId === car.id)}
                selectedId={selectedId}
                onSeat={(seat, occupant) => onSeat(car, seat, occupant)}
                onDropRider={(riderId, seat) => seatRider(riderId, car.id, seat)}
                onEdit={() => setDialog({ kind: "edit-car", car })}
              />
            ))}
            <button type="button" className="car-add" onClick={() => setDialog({ kind: "add-car" })}>
              <CarFront size={28} />
              <strong>{cars.length ? "Another driver?" : "Add the first car"}</strong>
              <span className="muted">Driver, car and spare seats</span>
            </button>
          </div>
        </section>

        <aside
          className={`waitlist card${waitOver ? " is-over" : ""}${selected?.carId ? " is-target" : ""}`}
          aria-label="Waitlist"
          onDragOver={(e) => { e.preventDefault(); setWaitOver(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setWaitOver(false); }}
          onDrop={onWaitlistDrop}
        >
          <div className="section-head">
            <h2>Waitlist <span className="count">{waiting.length}</span></h2>
            {waiting.length > 0 && cars.length > 0 && open > 0 && (
              <button className="btn btn-primary btn-sm" onClick={() => run(() => api.autoAssign(id), "Seats filled by pickup spot")}>
                <Wand2 size={15} /> Auto-fill
              </button>
            )}
          </div>

          <AddRider spots={spots} onAdd={(input) => run(() => api.addRider(id, input), `${firstName(input.name)} added to the waitlist`)} />

          {selected && selected.carId !== null && (
            <button className="drop-here" onClick={() => seatRider(selected.id, null, null)}>
              <UserMinus size={16} /> Move {firstName(selected.name)} back to the waitlist
            </button>
          )}

          {waiting.length === 0 ? (
            <div className="wait-empty">
              <p>{riders.length ? "Nobody's waiting. Every rider has a seat." : "Add everyone who needs a lift. They'll wait here until you seat them."}</p>
            </div>
          ) : (
            <ul className="rider-list">
              {waiting.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`rider${r.id === selectedId ? " is-selected" : ""}`}
                    draggable
                    onDragStart={(e) => startRiderDrag(e, r.id)}
                    onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                    aria-pressed={r.id === selectedId}
                  >
                    <span className="seat-avatar">{initials(r.name)}</span>
                    <span className="rider-text">
                      <strong>{r.name}</strong>
                      <small className="muted">{r.pickup || "No pickup spot"}{r.contact ? ` · ${r.contact}` : ""}</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn rider-remove"
                    aria-label={`Remove ${r.name} from the trip`}
                    onClick={() => run(() => api.deleteRider(id, r.id), `${firstName(r.name)} removed`)}
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="hint muted">Tap a rider, then tap a seat. On a computer you can drag them too.</p>
        </aside>
      </div>

      {selected && (
        <div className="placebar" role="region" aria-label="Seating">
          <span className="seat-avatar">{initials(selected.name)}</span>
          <span className="placebar-text">
            <strong>{selected.name}</strong>
            <small>{selected.carId ? "Tap another seat to move or swap" : "Tap an open seat"}</small>
          </span>
          {selected.carId !== null && (
            <button className="btn btn-ghost btn-sm on-dark" onClick={() => seatRider(selected.id, null, null)}>
              <UserMinus size={15} /> Unseat
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm on-dark"
            onClick={() => {
              setSelectedId(null);
              run(() => api.deleteRider(id, selected.id), `${firstName(selected.name)} removed`);
            }}
          >
            <Trash2 size={15} /> Remove
          </button>
          <button className="icon-btn on-dark" onClick={() => setSelectedId(null)} aria-label="Cancel"><X size={18} /></button>
        </div>
      )}

      <Modal open={dialog?.kind === "edit-trip"} title="Edit trip" onClose={() => setDialog(null)}>
        <TripForm initial={trip} submitLabel="Save trip" busy={busy} onSubmit={submitTrip} />
      </Modal>

      <Modal
        open={dialog?.kind === "add-car" || dialog?.kind === "edit-car"}
        title={dialog?.kind === "edit-car" ? `${firstName(dialog.car.driverName)}'s car` : "Add a car"}
        onClose={() => setDialog(null)}
      >
        <CarForm
          key={dialog?.kind === "edit-car" ? dialog.car.id : "new"}
          initial={dialog?.kind === "edit-car" ? dialog.car : undefined}
          spots={spots}
          busy={busy}
          submitLabel={dialog?.kind === "edit-car" ? "Save car" : "Add car"}
          onSubmit={submitCar}
        />
        {dialog?.kind === "edit-car" && (
          <button
            className="btn btn-ghost btn-block danger"
            onClick={async () => {
              const car = dialog.car;
              setDialog(null);
              await run(() => api.deleteCar(id, car.id), `${firstName(car.driverName)}'s car removed, riders moved to the waitlist`);
            }}
          >
            <Trash2 size={15} /> Remove this car
          </button>
        )}
      </Modal>

      <Modal
        open={dialog?.kind === "pick"}
        title={dialog?.kind === "pick" ? `Seat ${dialog.seat + 1} in ${firstName(dialog.car.driverName)}'s car` : ""}
        onClose={() => setDialog(null)}
      >
        <ul className="pick-list">
          {dialog?.kind === "pick" &&
            waiting.map((r) => (
              <li key={r.id}>
                <button
                  className="rider"
                  onClick={() => {
                    const d = dialog;
                    setDialog(null);
                    seatRider(r.id, d.car.id, d.seat);
                  }}
                >
                  <span className="seat-avatar">{initials(r.name)}</span>
                  <span className="rider-text">
                    <strong>{r.name}</strong>
                    <small className="muted">{r.pickup || "No pickup spot"}</small>
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </Modal>

      <Modal open={dialog?.kind === "delete-trip"} title="Delete this trip?" onClose={() => setDialog(null)}>
        <p className="muted">
          This removes {trip.title}, its {cars.length} {cars.length === 1 ? "car" : "cars"} and {riders.length} riders for everyone with
          the link. It can't be undone.
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setDialog(null)}>Keep it</button>
          <button className="btn btn-danger" onClick={deleteTrip} disabled={busy}>{busy ? "Deleting..." : "Delete trip"}</button>
        </div>
      </Modal>
    </div>
  );
}

function AddRider({ spots, onAdd }: { spots: string[]; onAdd: (input: RiderInput) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [pickup, setPickup] = useState("");
  const [contact, setContact] = useState("");
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    const ok = await onAdd({ name, pickup, contact });
    setSaving(false);
    if (ok) {
      setName("");
      setContact("");
      nameRef.current?.focus();
    }
  }

  return (
    <form className="add-rider" onSubmit={submit}>
      <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Rider's name" maxLength={60} aria-label="Rider's name" />
      <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Pickup spot" list="pickup-options" maxLength={120} aria-label="Pickup spot" />
      <datalist id="pickup-options">{spots.map((s) => <option key={s} value={s} />)}</datalist>
      {more && <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or @handle" maxLength={80} aria-label="Contact" />}
      <div className="add-rider-foot">
        {!more && <button type="button" className="link-btn" onClick={() => setMore(true)}>+ contact</button>}
        <button className="btn btn-dark btn-sm" disabled={saving}><Plus size={15} /> {saving ? "Adding..." : "Add rider"}</button>
      </div>
    </form>
  );
}

function TripSkeleton() {
  return (
    <div className="page trip-page">
      <header className="topbar"><Logo /></header>
      <div className="ticket skeleton" style={{ height: 260 }} />
      <div className="planner">
        <div className="car-grid">
          {[0, 1].map((i) => <div key={i} className="car skeleton" style={{ height: 320 }} />)}
        </div>
        <div className="waitlist card skeleton" style={{ height: 360 }} />
      </div>
    </div>
  );
}
