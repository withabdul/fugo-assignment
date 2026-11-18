// The sales team works in WIB, so "today" for the timeline rule is the date in Asia/Jakarta,
// not the server's UTC date. Returns YYYY-MM-DD, which compares correctly as a string.
export function todayInJakarta(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
