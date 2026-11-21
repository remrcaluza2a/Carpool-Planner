import { useState, type DragEvent } from "react";
import { MapPin, Pencil, Plus } from "lucide-react";
import type { Car, Rider } from "../lib/types";
import { firstName, initials } from "../lib/format";

export const DRAG_TYPE = "application/x-carpool-rider";

export function readDraggedRider(e: DragEvent): number | null {
  const raw = e.dataTransfer.getData(DRAG_TYPE) || e.dataTransfer.getData("text/plain");
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function startRiderDrag(e: DragEvent, riderId: number) {
  e.dataTransfer.setData(DRAG_TYPE, String(riderId));
  e.dataTransfer.setData("text/plain", String(riderId));
  e.dataTransfer.effectAllowed = "move";
}

// Front row holds the driver plus one passenger; the rest sit in rows of three.
function seatRows(seats: number): number[][] {
  const rows: number[][] = [[0]];
  for (let i = 1; i < seats; i += 3) {
    rows.push(Array.from({ length: Math.min(3, seats - i) }, (_, k) => i + k));
  }
  return rows;
}

export function CarCard({
  car,
  tone,
  riders,
  selectedId,
  delay,
  onSeat,
  onDropRider,
  onEdit,
}: {
  car: Car;
  tone: string;
  riders: Rider[];
  selectedId: number | null;
  delay: number;
  onSeat: (seatIndex: number, occupant: Rider | undefined) => void;
  onDropRider: (riderId: number, seatIndex: number) => void;
  onEdit: () => void;
}) {
  const [over, setOver] = useState<number | null>(null);
  const bySeat = new Map(riders.map((r) => [r.seatIndex!, r]));
  const filled = riders.length;
  const full = filled >= car.seats;
  const placing = selectedId !== null;

  const seat = (index: number) => {
    const occupant = bySeat.get(index);
    const isSelected = occupant && occupant.id === selectedId;
    const cls = [
      "seat",
      occupant ? "seat-taken" : "seat-open",
      isSelected && "seat-selected",
      placing && !isSelected && "seat-target",
      over === index && "seat-over",
    ]
      .filter(Boolean)
      .join(" ");
    const label = occupant
      ? `${occupant.name}, seat ${index + 1}${isSelected ? ", selected" : ""}`
      : `Open seat ${index + 1}`;
    return (
      <button
        key={index}
        type="button"
        className={cls}
        aria-label={label}
        aria-pressed={isSelected || undefined}
        draggable={Boolean(occupant)}
        onDragStart={occupant ? (e) => startRiderDrag(e, occupant.id) : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (over !== index) setOver(index);
        }}
        onDragLeave={() => setOver((o) => (o === index ? null : o))}
        onDrop={(e) => {
          e.preventDefault();
          setOver(null);
          const id = readDraggedRider(e);
          if (id !== null) onDropRider(id, index);
        }}
        onClick={() => onSeat(index, occupant)}
        title={occupant ? `${occupant.name}${occupant.pickup ? ` · ${occupant.pickup}` : ""}` : undefined}
      >
        {occupant ? (
          <>
            <span className="seat-avatar">{initials(occupant.name)}</span>
            <span className="seat-name">{firstName(occupant.name)}</span>
          </>
        ) : (
          <>
            <span className="seat-plus"><Plus size={14} /></span>
            <span className="seat-name">Seat {index + 1}</span>
          </>
        )}
      </button>
    );
  };

  return (
    <article className={`car tone-${tone} rise`} style={{ animationDelay: `${delay}ms` }}>
      <header className="car-head">
        <span className="car-avatar">{initials(car.driverName)}</span>
        <div className="car-title">
          <strong>{car.driverName}</strong>
          <span className="muted">{car.vehicle || "Driver"}</span>
        </div>
        <span className={`car-count mono${full ? " is-full" : ""}`}>{full ? "FULL" : `${filled}/${car.seats}`}</span>
        <button type="button" className="icon-btn" onClick={onEdit} aria-label={`Edit ${car.driverName}'s car`}>
          <Pencil size={15} />
        </button>
      </header>
      {car.leavingFrom && (
        <p className="car-from"><MapPin size={13} /> Leaving from {car.leavingFrom}</p>
      )}

      <div className="car-body">
        <div className="car-windshield" aria-hidden />
        {seatRows(car.seats).map((row, r) => (
          <div key={r} className={`seat-row seat-row-${r === 0 ? 2 : 3}`}>
            {r === 0 && (
              <div className="seat seat-driver" aria-label={`Driver: ${car.driverName}`}>
                <span className="seat-avatar">
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" />
                    <circle cx="12" cy="12" r="2.4" fill="currentColor" />
                    <path d="M3.5 11h6M14.5 11h6M12 14.5V21" stroke="currentColor" strokeWidth="2.4" />
                  </svg>
                </span>
                <span className="seat-name">{firstName(car.driverName)}</span>
              </div>
            )}
            {row.map(seat)}
          </div>
        ))}
        <div className="car-trunk" aria-hidden />
      </div>
    </article>
  );
}
