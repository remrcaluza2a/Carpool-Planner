import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";

export function NotFound({ message }: { message?: string }) {
  return (
    <div className="page">
      <header className="topbar"><Logo /></header>
      <div className="notfound">
        <p className="mono muted">Wrong turn</p>
        <h1>{message ?? "This page took a detour."}</h1>
        <p className="muted">The trip may have been deleted, or the link is missing a few characters.</p>
        <Link className="btn btn-primary" to="/">Back to your trips</Link>
      </div>
    </div>
  );
}
