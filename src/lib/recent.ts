// Trips this browser has created or opened. There are no accounts: a trip's link is
// the key to it, so we remember the links locally to build the "Your trips" list.
const KEY = "carpool-planner:trips";

export function getRecentTripIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rememberTrip(id: string) {
  const ids = [id, ...getRecentTripIds().filter((x) => x !== id)].slice(0, 30);
  localStorage.setItem(KEY, JSON.stringify(ids));
}

export function forgetTrip(id: string) {
  localStorage.setItem(KEY, JSON.stringify(getRecentTripIds().filter((x) => x !== id)));
}
