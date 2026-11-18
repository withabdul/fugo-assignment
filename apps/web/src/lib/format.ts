const dateTime = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});
const dateOnly = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

// target_date is a plain YYYY-MM-DD with no time zone, so format it as UTC
// to avoid showing the day before.
export const formatDate = (isoDate: string) => dateOnly.format(new Date(`${isoDate}T00:00:00Z`));

export const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
