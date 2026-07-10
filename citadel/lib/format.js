export function dateLine(date) {
  return date
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toLowerCase();
}

// Meditation rows: date only, no weekday ("july 10, 2026").
export function dayLine(date) {
  return date
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toLowerCase();
}

// Splash-screen date: no year ("thursday, july 9") — the splash design
// letterspaces and uppercases it in CSS.
export function shortDateLine(date) {
  return date
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toLowerCase();
}

export function timeLine(date) {
  return date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
}
