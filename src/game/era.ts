import type { EraBucket } from "../types";

export interface Era {
  start: number;
  end: number;
  label: string;
  kind: "decade" | "century";
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Years use astronomical-free numbering: there is no year 0, negative = BCE. */
export function fmtYear(y: number): string {
  return y < 0 ? `${-y} BCE` : `${y}`;
}

export function centuryEra(year: number): Era {
  const y = year === 0 ? 1 : year;
  if (y > 0) {
    const n = Math.ceil(y / 100);
    return { start: (n - 1) * 100 + 1, end: n * 100, label: `the ${ordinal(n)} century`, kind: "century" };
  }
  const n = Math.ceil(-y / 100);
  return { start: -n * 100, end: -(n - 1) * 100 - 1, label: `the ${ordinal(n)} century BCE`, kind: "century" };
}

export function decadeEra(year: number): Era {
  const start = Math.floor(year / 10) * 10;
  return { start, end: start + 9, label: `the ${start}s`, kind: "decade" };
}

export function midYear(start: number, end: number): number {
  return Math.round((start + end) / 2);
}

/**
 * Candidate eras for an event: the century (always) and the decade (from 1700 on)
 * of its start, middle and end years.
 */
export function eventEras(startYear: number, endYear: number): Era[] {
  const anchors = [...new Set([startYear, midYear(startYear, endYear), endYear])];
  const out = new Map<string, Era>();
  for (const y of anchors) {
    const c = centuryEra(y);
    out.set(c.label, c);
    if (y >= 1700) {
      const d = decadeEra(y);
      out.set(d.label, d);
    }
  }
  return [...out.values()];
}

export function eraBucket(year: number): EraBucket {
  if (year < 500) return "ancient";
  if (year < 1500) return "medieval";
  if (year < 1800) return "early-modern";
  if (year < 1900) return "19th-century";
  return "20th-century+";
}

/** Inclusive year range of each bucket. */
export const ERA_BUCKET_RANGES: Record<EraBucket, [number, number]> = {
  ancient: [-100000, 499],
  medieval: [500, 1499],
  "early-modern": [1500, 1799],
  "19th-century": [1800, 1899],
  "20th-century+": [1900, 100000],
};

export const ERA_BUCKET_LABELS: Record<EraBucket, string> = {
  ancient: "Ancient (before 500)",
  medieval: "Medieval (500-1499)",
  "early-modern": "Early modern (1500-1799)",
  "19th-century": "19th century",
  "20th-century+": "20th century and later",
};

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
