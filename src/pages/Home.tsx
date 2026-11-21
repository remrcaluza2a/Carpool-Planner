import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CarFront, MapPin, Sparkles, Users } from "lucide-react";
import { api, type TripInput } from "../lib/api";
import { forgetTrip, getRecentTripIds, rememberTrip } from "../lib/recent";
import { formatWhen, relativeDays } from "../lib/format";
import type { TripSummary } from "../lib/types";
import { TripForm } from "../components/TripForm";
import { useToast } from "../components/Toast";
import { Logo } from "../components/Logo";

const STEPS = [
  { title: "Make the trip", body: "Name it, set where you're going and when you leave." },
  { title: "Drivers add cars", body: "Each driver says how many seats they can spare." },
  { title: "Riders hop on", body: "Everyone who needs a lift joins the waitlist with their pickup spot." },
  { title: "Fill the seats", body: "Drag people into seats or auto-fill by pickup spot, then paste the plan in the group chat." },
];

export function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [trips, setTrips] = useState<TripSummary[] | null>(null);

  useEffect(() => {
    const ids = getRecentTripIds();
    if (ids.length === 0) {
      setTrips([]);
      return;
    }
    api
      .listTrips(ids)
      .then(({ trips: found }) => {
        // Drop trips that were deleted elsewhere, keep the most-recently-opened order.
        const byId = new Map(found.map((t) => [t.id, t]));
        ids.filter((id) => !byId.has(id)).forEach(forgetTrip);
        setTrips(ids.map((id) => byId.get(id)).filter((t): t is TripSummary => Boolean(t)));
      })
      .catch(() => setTrips([]));
  }, []);

  async function create(input: TripInput) {
    setCreating(true);
    try {
      const { trip } = await api.createTrip(input);
      rememberTrip(trip.id);
      navigate(`/trips/${trip.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setCreating(false);
    }
  }

  async function openSample() {
    setSampling(true);
    try {
      const { trip } = await api.createSample();
      rememberTrip(trip.id);
      navigate(`/trips/${trip.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setSampling(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <Logo />
        <nav className="topbar-nav">
          <a href="#how">How it works</a>
          <button className="btn btn-ghost btn-sm" onClick={openSample} disabled={sampling}>
            <Sparkles size={15} /> {sampling ? "Loading..." : "Sample trip"}
          </button>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow rise" style={{ animationDelay: "40ms" }}>For road trips, away games &amp; airport runs</p>
          <h1 className="rise" style={{ animationDelay: "120ms" }}>
            Who's driving?<br />
            Who's riding?<br />
            <span className="hl">Sorted.</span>
          </h1>
          <p className="lede rise" style={{ animationDelay: "220ms" }}>
            Carpool Planner lines up the cars, the seats and the people who need them. Make a trip, share one link
            with the group chat, and drop everyone into a seat. No accounts, no spreadsheets.
          </p>
          <div className="hero-cta rise" style={{ animationDelay: "320ms" }}>
            <a href="#new-trip" className="btn btn-primary">
              Plan a trip <ArrowRight size={17} />
            </a>
            <button className="btn btn-outline" onClick={openSample} disabled={sampling}>
              {sampling ? "Opening..." : "Open a sample trip"}
            </button>
          </div>
        </div>

        <figure className="hero-art rise" style={{ animationDelay: "200ms" }}>
          <img
            src="/.netlify/images?url=/img/hero.png&w=1100&fm=webp&q=78"
            alt="Illustration of three cars full of students driving along a winding road through a campus town"
            width={1100}
            height={614}
          />
          <div className="hero-stub">
            <span className="mono">FRI · 4:30 PM</span>
            <strong>Lake Wendell weekend</strong>
            <div className="hero-stub-row">
              <span><CarFront size={14} /> 3 cars</span>
              <span><Users size={14} /> 13 seats</span>
              <span className="warn">3 waiting</span>
            </div>
          </div>
        </figure>
      </section>

      <section className="desk" id="new-trip">
        <div className="desk-form card">
          <p className="eyebrow">New trip</p>
          <h2>Where's everyone headed?</h2>
          <TripForm submitLabel="Create trip & add cars" busy={creating} onSubmit={create} />
        </div>

        <div className="desk-trips">
          <div className="section-head">
            <h2>Your trips</h2>
            {trips && trips.length > 0 && <span className="mono muted">{trips.length} saved on this device</span>}
          </div>

          {trips === null && (
            <div className="stub-list">
              {[0, 1].map((i) => <div key={i} className="stub skeleton" />)}
            </div>
          )}

          {trips && trips.length === 0 && (
            <div className="empty">
              <div className="empty-road" aria-hidden />
              <h3>No trips yet</h3>
              <p>Trips you create or open from a shared link show up here. Start one on the left, or poke around a sample.</p>
              <button className="btn btn-outline btn-sm" onClick={openSample} disabled={sampling}>
                <Sparkles size={15} /> Open a sample trip
              </button>
            </div>
          )}

          {trips && trips.length > 0 && (
            <div className="stub-list">
              {trips.map((t, i) => {
                const waiting = t.riderCount - t.seatedCount;
                const open = t.seatCount - t.seatedCount;
                return (
                  <Link key={t.id} to={`/trips/${t.id}`} className="stub rise" style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="stub-date">
                      <span className="mono">{relativeDays(t.departAt)}</span>
                      <small>{formatWhen(t.departAt)}</small>
                    </div>
                    <div className="stub-main">
                      <strong>{t.title}</strong>
                      <span className="muted"><MapPin size={13} /> {t.destination}</span>
                    </div>
                    <div className="stub-meta">
                      <span>{t.carCount} {t.carCount === 1 ? "car" : "cars"}</span>
                      <span>{t.seatedCount}/{t.seatCount} seats</span>
                      {waiting > 0 ? (
                        <span className="pill pill-warn">{waiting} waiting</span>
                      ) : t.riderCount > 0 ? (
                        <span className="pill pill-ok">All seated</span>
                      ) : (
                        <span className="pill">{open} open</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="how" id="how">
        <div className="section-head">
          <h2>How a carpool comes together</h2>
        </div>
        <ol className="route">
          {STEPS.map((s, i) => (
            <li key={s.title} className="route-stop">
              <span className="route-dot mono">{String(i + 1).padStart(2, "0")}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="footer">
        <Logo small />
        <span className="muted">Anyone with a trip's link can plan it, so share it only with your group.</span>
      </footer>
    </div>
  );
}
