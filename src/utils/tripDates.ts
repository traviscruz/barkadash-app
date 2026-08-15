// Shared trip date-range helpers. A locked trip stores its dates as a display
// string like "Mar 1, 2026 – Mar 5, 2026"; these parse it into a {start,end}
// pair and the number of itinerary day pills (1-based, capped at 7).

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5, july: 6,
  august: 7, september: 8, october: 9, november: 10, december: 11,
};

const parseDate = (text: string): Date | null => {
  const m = text.match(/([A-Za-z]+)\s+(\d{1,2})(?:,)?\s+(\d{4})/);
  if (!m) return null;
  const month = MONTH_MAP[m[1].toLowerCase()];
  if (month === undefined) return null;
  const d = new Date(Number(m[3]), month, Number(m[2]));
  if (isNaN(d.getTime())) return null;
  return d;
};

export const parseTripDateRange = (range?: string): { start: Date; end: Date } | null => {
  if (!range) return null;
  const tokens = range
    .split(/\s*[-–—]\s*| to |\s+-\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const start = parseDate(tokens[0] || '');
  if (!start) return null;
  const end = tokens.length >= 2 ? parseDate(tokens[tokens.length - 1]) : start;
  if (!end) return null;
  return { start, end };
};

export const tripDayCount = (range?: string): number => {
  const d = parseTripDateRange(range);
  if (!d) return 4;
  const days = Math.round((d.end.getTime() - d.start.getTime()) / 86400000) + 1;
  return Math.min(Math.max(days, 1), 7);
};
