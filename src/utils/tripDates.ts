// Shared trip date-range helpers. A locked trip stores its dates as a display
// string like "Mar 1, 2026 – Mar 5, 2026" or "Sep 15 - Sep 18"; these parse it into a {start,end}
// pair and the number of itinerary day pills (1-based, capped at 7).

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5, july: 6,
  august: 7, september: 8, october: 9, november: 10, december: 11,
  sept: 8,
};

const parseDate = (text: string, fallbackYear?: number, fallbackMonth?: number): Date | null => {
  if (!text) return null;
  const currentYear = fallbackYear || new Date().getFullYear();

  // Pattern 1: ISO "YYYY-MM-DD"
  const isoMatch = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const d = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    if (!isNaN(d.getTime())) return d;
  }

  // Pattern 2: Numeric "MM/DD/YYYY"
  const numMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (numMatch) {
    const d = new Date(Number(numMatch[3]), Number(numMatch[1]) - 1, Number(numMatch[2]));
    if (!isNaN(d.getTime())) return d;
  }

  // Pattern 3: Month Name + Day + Optional Year (e.g. "Mar 1, 2026", "March 1 2026", "Mar 1")
  const m1 = text.match(/([A-Za-z]+)\s+(\d{1,2})(?:,)?(?:\s+(\d{4}))?/);
  if (m1) {
    const month = MONTH_MAP[m1[1].toLowerCase()];
    if (month !== undefined) {
      const year = m1[3] ? Number(m1[3]) : currentYear;
      const d = new Date(year, month, Number(m1[2]));
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Pattern 4: Day + Month Name + Optional Year (e.g. "1 Mar 2026", "1 March")
  const m2 = text.match(/(\d{1,2})\s+([A-Za-z]+)(?:,)?(?:\s+(\d{4}))?/);
  if (m2) {
    const month = MONTH_MAP[m2[2].toLowerCase()];
    if (month !== undefined) {
      const year = m2[3] ? Number(m2[3]) : currentYear;
      const d = new Date(year, month, Number(m2[1]));
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Pattern 5: Just a day number (e.g. "27, 2026" or "27") with fallback month/year
  const m3 = text.match(/^(\d{1,2})(?:,)?(?:\s+(\d{4}))?$/);
  if (m3 && fallbackMonth !== undefined) {
    const year = m3[2] ? Number(m3[2]) : currentYear;
    const d = new Date(year, fallbackMonth, Number(m3[1]));
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback to native Date parser
  const nativeParsed = new Date(text);
  if (!isNaN(nativeParsed.getTime())) return nativeParsed;

  return null;
};

export const parseTripDateRange = (range?: string): { start: Date; end: Date } | null => {
  if (!range) return null;
  const cleanRange = range.split('·')[0].trim();
  if (!cleanRange || /^(Dates TBD|TBD|Upcoming|Planning Phase|Planning Stage)$/i.test(cleanRange)) {
    return null;
  }

  const tokens = cleanRange
    .split(/\s*[-–—]\s*| to |\s+-\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) return null;

  let yearHint: number | undefined;
  for (const t of tokens) {
    const ym = t.match(/\b(20\d{2})\b/);
    if (ym) {
      yearHint = Number(ym[1]);
      break;
    }
  }

  const start = parseDate(tokens[0] || '', yearHint);
  if (!start) return null;

  let end: Date | null = null;
  if (tokens.length >= 2) {
    end = parseDate(tokens[tokens.length - 1], start.getFullYear(), start.getMonth());
  }

  if (!end) end = start;
  if (end < start) {
    end = new Date(start.getTime() + 86400000 * 3);
  }

  return { start, end };
};

export const tripDayCount = (range?: string): number => {
  const d = parseTripDateRange(range);
  if (!d) return 4;
  const days = Math.round((d.end.getTime() - d.start.getTime()) / 86400000) + 1;
  return Math.min(Math.max(days, 1), 7);
};

/**
 * Returns true if the reference date (defaults to today) falls within the trip's date range (inclusive).
 */
export const isWithinTripDates = (range?: string, referenceDate: Date = new Date()): boolean => {
  const d = parseTripDateRange(range);
  if (!d) return false;
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()).getTime();
  const start = new Date(d.start.getFullYear(), d.start.getMonth(), d.start.getDate()).getTime();
  const end = new Date(d.end.getFullYear(), d.end.getMonth(), d.end.getDate()).getTime();
  return today >= start && today <= end;
};

export interface TripDayInfo {
  currentDay: number;
  totalDays: number;
  isEarly: boolean;
  isLastDay: boolean;
  isEnded: boolean;
  isBeforeStart: boolean;
}

/**
 * Computes the current 1-based day index and total day count of a trip date range.
 */
export const getTripDayInfo = (range?: string, referenceDate: Date = new Date()): TripDayInfo | null => {
  const d = parseTripDateRange(range);
  if (!d) return null;
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()).getTime();
  const start = new Date(d.start.getFullYear(), d.start.getMonth(), d.start.getDate()).getTime();
  const end = new Date(d.end.getFullYear(), d.end.getMonth(), d.end.getDate()).getTime();

  const totalDays = Math.max(Math.round((end - start) / 86400000) + 1, 1);
  const diffFromStart = Math.floor((today - start) / 86400000);
  const currentDay = Math.max(1, Math.min(diffFromStart + 1, totalDays));

  return {
    currentDay,
    totalDays,
    isEarly: currentDay < totalDays,
    isLastDay: currentDay === totalDays,
    isEnded: today > end,
    isBeforeStart: today < start,
  };
};

/**
 * Converts a time string (e.g. "8:00 AM", "1:30 PM", "14:00") to minutes from midnight (0 - 1439).
 * Returns Number.MAX_SAFE_INTEGER for empty/invalid strings so they sort to the bottom.
 */
export const timeStringToMinutes = (t?: string | null): number => {
  if (!t) return Number.MAX_SAFE_INTEGER;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return Number.MAX_SAFE_INTEGER;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
};

/**
 * Sorts itinerary items chronologically from first to last (earliest to latest in the day).
 * Handles both 12-hour and 24-hour time strings correctly.
 */
export const sortItineraryChronological = <T extends { time?: string; dayNumber?: number; createdAt?: string }>(
  items: T[]
): T[] => {
  return [...items].sort((a, b) => {
    const da = a.dayNumber ?? 1;
    const db = b.dayNumber ?? 1;
    if (da !== db) return da - db;
    const ta = timeStringToMinutes(a.time);
    const tb = timeStringToMinutes(b.time);
    if (ta !== tb) return ta - tb;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
};

