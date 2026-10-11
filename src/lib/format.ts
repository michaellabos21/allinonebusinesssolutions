import { getRuntime, getToday } from "@/lib/runtime";

const DAY_MS = 86_400_000;

/** Parses a `YYYY-MM-DD` (or ISO date-time) string as a UTC calendar date. */
function toUtcDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

/** Formats integer minor units (centavos) as workspace currency. */
export function formatMoney(
  amountMinor: number,
  {
    currency = getRuntime().currency,
    locale = getRuntime().locale,
  }: { currency?: string; locale?: string } = {},
) {
  const whole = amountMinor % 100 === 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

/** Short axis form, e.g. ₱146.5K. */
export function formatMoneyCompact(amountMinor: number) {
  return new Intl.NumberFormat(getRuntime().locale, {
    style: "currency",
    currency: getRuntime().currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amountMinor / 100);
}

/**
 * Converts typed input such as "12,500.50" to integer minor units without
 * floating-point multiplication. Returns null when the text is not an amount.
 */
export function parseAmountToMinor(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(major * 100 + minor)) return null;
  return major * 100 + minor;
}

/** Minor units back to what a person would type, e.g. 1250050 -> "12500.50". */
export function formatAmountInput(amountMinor: number) {
  const cents = amountMinor % 100;
  return `${Math.floor(amountMinor / 100)}${cents ? `.${String(cents).padStart(2, "0")}` : ""}`;
}

type DateStyle = "short" | "long" | "weekday" | "weekdayShort";

const DATE_FORMATS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: "numeric", month: "short" },
  long: { day: "numeric", month: "short", year: "numeric" },
  weekday: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  weekdayShort: { weekday: "long", day: "numeric", month: "long" },
};

export function formatDate(iso: string, style: DateStyle = "short") {
  return new Intl.DateTimeFormat(getRuntime().dateLocale, {
    ...DATE_FORMATS[style],
    timeZone: "UTC",
  }).format(toUtcDate(iso));
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string) {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / DAY_MS);
}

export function addDays(iso: string, days: number) {
  return new Date(toUtcDate(iso).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** "Today", "Yesterday", "3 days ago", then a plain date. */
export function formatRelativeDay(iso: string, today: string = getToday()) {
  const days = daysBetween(iso, today);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days} days ago`;
  return formatDate(iso);
}

export type DueTone = "overdue" | "today" | "upcoming";

/** Describes a due date relative to today, with a tone for styling. */
export function describeDue(
  iso: string,
  today: string = getToday(),
): { label: string; tone: DueTone } {
  const days = daysBetween(today, iso);
  if (days < 0) {
    const late = Math.abs(days);
    return { label: `${late} ${late === 1 ? "day" : "days"} overdue`, tone: "overdue" };
  }
  if (days === 0) return { label: "Due today", tone: "today" };
  if (days === 1) return { label: "Due tomorrow", tone: "upcoming" };
  return { label: `Due ${formatDate(iso)}`, tone: "upcoming" };
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      // Skip words like "&" that do not start with a letter or digit.
      .filter((part) => /^[\p{L}\p{N}]/u.test(part))
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
  );
}
