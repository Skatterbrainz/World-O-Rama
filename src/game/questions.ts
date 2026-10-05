import { COUNTRIES, countryByIso } from "../data/countries";
import { REGION_ADJECTIVES, RESOURCES, SUBREGION_PHRASES, TYPE_LABELS, TYPE_NOUNS, TYPE_VERBS } from "../data/vocab";
import type { Constraints, EraBucket, GameEvent, Question, Region } from "../types";
import { eraBucket, eventEras, fmtYear, midYear, overlaps } from "./era";
import { MAX_HINTS } from "./scoring";

export const DEFAULT_MAX_ANSWERS = 4;

/** Lower-case and drop a leading "the " so "the Soviet Union" and "Soviet Union" are the same exploiter. */
export function normName(label: string): string {
  return label.trim().toLowerCase().replace(/^the\s+/, "");
}

/** "A European", "A Uruguayan", but "An African", "An Oceanian": a leading "yoo" sound takes "a". */
export function aOrAn(phrase: string): string {
  if (/^(eu|uni|use|ura|uru|uti|ugand)/i.test(phrase)) return `A ${phrase}`;
  return /^[aeiou]/i.test(phrase) ? `An ${phrase}` : `A ${phrase}`;
}

function nounPhrase(c: Constraints): string {
  if (c.subregion) return SUBREGION_PHRASES[c.subregion] ?? `${c.subregion} nation`;
  if (c.region) return `${REGION_ADJECTIVES[c.region]} nation`;
  return "nation";
}

export function matches(ev: GameEvent, c: Constraints): boolean {
  if (c.eventId !== undefined) return ev.id === c.eventId;
  const country = countryByIso(ev.country);
  if (!country) return false;
  if (c.region && country.region !== c.region) return false;
  if (c.subregion && country.subregion !== c.subregion) return false;
  if (c.exploiter && normName(ev.exploiter.label) !== c.exploiter) return false;
  if (c.resource && !ev.resources.includes(c.resource)) return false;
  if (c.type && ev.type !== c.type) return false;
  if (c.alleged !== undefined && Boolean(ev.alleged) !== c.alleged) return false;
  if (c.territoryName && !(ev.territoryNames ?? []).some((n) => normName(n) === c.territoryName)) return false;
  if (c.eraStart !== undefined && c.eraEnd !== undefined) {
    if (!overlaps(ev.startYear, ev.endYear, c.eraStart, c.eraEnd)) return false;
  }
  return true;
}

/** Insert "allegedly" before the participle: "was exploited by" -> "was allegedly exploited by". */
export function allegedly(verbPhrase: string): string {
  const words = verbPhrase.split(" ");
  const byIdx = words.lastIndexOf("by");
  const at = byIdx > 0 ? byIdx - 1 : 1;
  words.splice(at, 0, "allegedly");
  return words.join(" ");
}

export function constraintsKey(c: Constraints): string {
  return Object.entries(c)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(";");
}

interface Candidate {
  template: string;
  text: string;
  difficulty: 1 | 2 | 3;
  constraints: Constraints;
  event: GameEvent;
  hintsTail?: string[];
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const REGION_NAMES: Record<string, string> = {
  Africa: "Africa",
  Asia: "Asia",
  Europe: "Europe",
  "North America": "North America",
  "South America": "South America",
  Oceania: "Oceania",
};

/** Geography hint about the country itself (island, landlocked), or null when none applies. */
export function geographyHint(country: { island: "whole" | "shared" | null; landlocked: boolean }): string | null {
  if (country.island === "whole") return "Hint: it is an island or an archipelago.";
  if (country.island === "shared") return "Hint: it shares its island with another country.";
  if (country.landlocked) return "Hint: it is landlocked.";
  return null;
}

/**
 * Hint ladder, cheapest first: the continent, island or landlocked status, the sub-region, the authored
 * clues (vague to specific), then what was taken, what kind of episode it was, who did it and when.
 */
function autoHints(ev: GameEvent, c: Constraints, authored: string[]): string[] {
  const country = countryByIso(ev.country);
  const hints: string[] = [];
  if (country) {
    if (!c.region && !c.subregion) hints.push(`Hint: it is in ${REGION_NAMES[country.region]}.`);
    const geo = geographyHint(country);
    if (geo) hints.push(geo);
    if (!c.subregion && country.subregion) {
      const phrase = SUBREGION_PHRASES[country.subregion] ?? `${country.subregion} nation`;
      hints.push(`Hint: it is ${aOrAn(phrase).toLowerCase()}.`);
    }
  }
  hints.push(...authored);
  if (!c.resource) {
    const names = ev.resources.map((r) => RESOURCES[r]).filter((x): x is string => Boolean(x));
    if (names.length) hints.push(`Hint: it involved ${joinList(names.slice(0, 3))}.`);
  }
  if (!c.type && TYPE_LABELS[ev.type]) hints.push(`Hint: the episode involved ${TYPE_LABELS[ev.type]}.`);
  if (!c.exploiter) hints.push(`Hint: the exploiter was ${ev.alleged ? "allegedly " : ""}${ev.exploiter.label}.`);
  if (c.eraStart === undefined) {
    hints.push(
      ev.startYear === ev.endYear
        ? `Hint: this happened in ${fmtYear(ev.startYear)}.`
        : `Hint: this ran from ${fmtYear(ev.startYear)} to ${fmtYear(ev.endYear)}.`,
    );
  }
  return hints.slice(0, MAX_HINTS);
}

function* candidatesFor(ev: GameEvent): Generator<Candidate> {
  const country = countryByIso(ev.country);
  if (!country) return;
  const exploiter = normName(ev.exploiter.label);
  const label = ev.exploiter.label;
  const eras = eventEras(ev.startYear, ev.endYear);
  const region: Region = country.region;
  const sub = country.subregion ?? undefined;
  const hasType = ev.type !== "other";
  const exploitedBy = ev.alleged ? allegedly("was exploited by") : "was exploited by";
  const typeVerb = ev.alleged ? allegedly(TYPE_VERBS[ev.type]) : TYPE_VERBS[ev.type];

  for (const era of eras) {
    const eraC = { eraStart: era.start, eraEnd: era.end };
    const eraText = `in ${era.label}`;

    // T2: region + exploiter + era (and subregion variant)
    yield {
      template: "region-exploiter-era",
      text: `${aOrAn(nounPhrase({ region }))} that ${exploitedBy} ${label} ${eraText}`,
      difficulty: 2,
      constraints: { region, exploiter, ...eraC },
      event: ev,
    };
    if (sub) {
      yield {
        template: "subregion-exploiter-era",
        text: `${aOrAn(nounPhrase({ subregion: sub }))} that ${exploitedBy} ${label} ${eraText}`,
        difficulty: 1,
        constraints: { subregion: sub, exploiter, ...eraC },
        event: ev,
      };
    }

    for (const r of ev.resources) {
      const phrase = RESOURCES[r];
      if (!phrase) continue;
      // T1: region + exploiter + resource + era
      yield {
        template: "region-exploiter-resource-era",
        text: `${aOrAn(nounPhrase({ region }))} that ${exploitedBy} ${label} for ${phrase} ${eraText}`,
        difficulty: 1,
        constraints: { region, exploiter, resource: r, ...eraC },
        event: ev,
      };
      if (sub) {
        yield {
          template: "subregion-exploiter-resource-era",
          text: `${aOrAn(nounPhrase({ subregion: sub }))} that ${exploitedBy} ${label} for ${phrase} ${eraText}`,
          difficulty: 1,
          constraints: { subregion: sub, exploiter, resource: r, ...eraC },
          event: ev,
        };
      }
      // T3b: exploiter + resource + era (any region)
      yield {
        template: "exploiter-resource-era",
        text: `A nation that ${exploitedBy} ${label} for ${phrase} ${eraText}`,
        difficulty: 2,
        constraints: { exploiter, resource: r, ...eraC },
        event: ev,
      };
    }

    if (hasType) {
      // T5: region + type + era
      yield {
        template: "region-type-era",
        text: `${aOrAn(nounPhrase({ region }))} that ${TYPE_NOUNS[ev.type]} ${eraText}`,
        difficulty: 3,
        constraints: { region, type: ev.type, ...eraC },
        event: ev,
      };
      // T6: exploiter + type + era
      yield {
        template: "exploiter-type-era",
        text: `A nation that ${typeVerb} ${label} ${eraText}`,
        difficulty: 3,
        constraints: { exploiter, type: ev.type, ...eraC },
        event: ev,
      };
      // T6b: region (or subregion) + exploiter + type + era, e.g. "A South American nation that had
      // its government overthrown in a coup backed by the CIA in the 1970s"
      yield {
        template: "region-exploiter-type-era",
        text: `${aOrAn(nounPhrase({ region }))} that ${typeVerb} ${label} ${eraText}`,
        difficulty: 2,
        constraints: { region, exploiter, type: ev.type, ...eraC },
        event: ev,
      };
      if (sub) {
        yield {
          template: "subregion-exploiter-type-era",
          text: `${aOrAn(nounPhrase({ subregion: sub }))} that ${typeVerb} ${label} ${eraText}`,
          difficulty: 1,
          constraints: { subregion: sub, exploiter, type: ev.type, ...eraC },
          event: ev,
        };
      }
    }
  }

  // T3: exploiter + resource (no era)
  for (const r of ev.resources) {
    const phrase = RESOURCES[r];
    if (!phrase) continue;
    yield {
      template: "exploiter-resource",
      text: `A nation that ${exploitedBy} ${label} for ${phrase}`,
      difficulty: 2,
      constraints: { exploiter, resource: r },
      event: ev,
    };
    yield {
      template: "region-exploiter-resource",
      text: `${aOrAn(nounPhrase({ region }))} that ${exploitedBy} ${label} for ${phrase}`,
      difficulty: 2,
      constraints: { region, exploiter, resource: r },
      event: ev,
    };
  }

  // T6c: region + exploiter + type (no era), e.g. "An Eastern European nation that was invaded by the Soviet Union"
  if (hasType) {
    yield {
      template: "region-exploiter-type",
      text: `${aOrAn(nounPhrase({ region }))} that ${typeVerb} ${label}`,
      difficulty: 2,
      constraints: { region, exploiter, type: ev.type },
      event: ev,
    };
    if (sub) {
      yield {
        template: "subregion-exploiter-type",
        text: `${aOrAn(nounPhrase({ subregion: sub }))} that ${typeVerb} ${label}`,
        difficulty: 1,
        constraints: { subregion: sub, exploiter, type: ev.type },
        event: ev,
      };
    }
  }

  // T4: historical territory names
  for (const name of ev.territoryNames ?? []) {
    yield {
      template: "territory-name",
      text: `A modern nation that was once part of ${name}`,
      difficulty: 2,
      constraints: { territoryName: normName(name) },
      event: ev,
    };
  }

  // T7: authored clues, vague (index 0) to specific
  const hints = ev.hints ?? [];
  for (let i = 0; i < hints.length; i++) {
    const difficulty: 1 | 2 | 3 = hints.length === 1 ? 2 : i === hints.length - 1 ? 1 : i === 0 ? 3 : 2;
    yield {
      template: "authored-clue",
      text: hints[i],
      difficulty,
      constraints: { eventId: ev.id, hintIndex: i },
      event: ev,
      hintsTail: hints.slice(i + 1),
    };
  }
}

export interface QuestionBank {
  questions: Question[];
  /** Questions that accept a given country (any country in their answer set). */
  byCountry: Map<string, Question[]>;
  /** Questions grouped by the country of the event that generated them. */
  bySourceCountry: Map<string, Question[]>;
  /** Questions dropped because too many countries satisfy them. */
  tooAmbiguous: Question[];
}

export function buildQuestionBank(events: GameEvent[], maxAnswers = DEFAULT_MAX_ANSWERS): QuestionBank {
  const byExploiter = new Map<string, GameEvent[]>();
  for (const ev of events) {
    const k = normName(ev.exploiter.label);
    const list = byExploiter.get(k);
    if (list) list.push(ev);
    else byExploiter.set(k, [ev]);
  }

  const seen = new Map<string, Question>();
  const tooAmbiguous: Question[] = [];
  const ambiguousKeys = new Set<string>();

  for (const ev of events) {
    for (const cand of candidatesFor(ev)) {
      if (cand.constraints.exploiter) cand.constraints.alleged = Boolean(ev.alleged);
      const key = constraintsKey(cand.constraints);
      if (seen.has(key) || ambiguousKeys.has(key)) continue;
      const pool = cand.constraints.exploiter ? (byExploiter.get(cand.constraints.exploiter) ?? []) : events;
      const answers = new Set<string>();
      for (const other of pool) if (matches(other, cand.constraints)) answers.add(other.country);
      const q: Question = {
        key,
        template: cand.template,
        text: cand.text,
        difficulty: cand.difficulty,
        constraints: cand.constraints,
        answers: [...answers].sort(),
        sourceEventId: ev.id,
        sourceCountry: ev.country,
        sourceType: ev.type,
        sourceExploiter: normName(ev.exploiter.label),
        hints: autoHints(ev, cand.constraints, cand.template === "authored-clue" ? (cand.hintsTail ?? []) : (ev.hints ?? [])),
        year: midYear(ev.startYear, ev.endYear),
      };
      if (q.answers.length > maxAnswers) {
        ambiguousKeys.add(key);
        tooAmbiguous.push(q);
        continue;
      }
      seen.set(key, q);
    }
  }

  const questions = [...seen.values()];
  const byCountry = new Map<string, Question[]>();
  const bySourceCountry = new Map<string, Question[]>();
  for (const q of questions) {
    for (const a of q.answers) {
      const list = byCountry.get(a);
      if (list) list.push(q);
      else byCountry.set(a, [q]);
    }
    const s = bySourceCountry.get(q.sourceCountry);
    if (s) s.push(q);
    else bySourceCountry.set(q.sourceCountry, [q]);
  }
  return { questions, byCountry, bySourceCountry, tooAmbiguous };
}

// ---- Selection -------------------------------------------------------------

export type Topic = "coups" | "invasions" | "colonialism" | "occupation";

/** Quick themes for the Settings dialog. Each matches on the event behind the question. */
export const TOPICS: Record<Topic, { label: string; test: (q: Question) => boolean }> = {
  coups: { label: "Coups and CIA operations", test: (q) => q.sourceType === "coup" || q.sourceExploiter === "cia" },
  invasions: { label: "Invasions", test: (q) => q.sourceType === "invasion" },
  colonialism: { label: "Colonialism", test: (q) => q.sourceType === "colonization" },
  occupation: { label: "Occupations and annexations", test: (q) => q.sourceType === "occupation" || q.sourceType === "annexation" },
};

export interface Filters {
  regions: Region[] | null;
  eras: EraBucket[] | null;
  difficulties: (1 | 2 | 3)[] | null;
  topic?: Topic | null;
}

export const NO_FILTERS: Filters = { regions: null, eras: null, difficulties: null, topic: null };

export interface CountryRecord {
  asked: number;
  correct: number;
}

export interface PickContext {
  filters: Filters;
  askedKeys: Set<string>;
  recentCountries: string[];
  countryStats: Map<string, CountryRecord>;
  rng?: () => number;
}

export function passesFilters(q: Question, f: Filters): boolean {
  if (f.difficulties && !f.difficulties.includes(q.difficulty)) return false;
  if (f.topic && !TOPICS[f.topic].test(q)) return false;
  if (f.eras && !f.eras.includes(eraBucket(q.year))) return false;
  if (f.regions) {
    const ok = q.answers.some((a) => {
      const c = countryByIso(a);
      return c ? f.regions!.includes(c.region) : false;
    });
    if (!ok) return false;
  }
  return true;
}

/** Weight for choosing a country: unseen and often-missed countries come back sooner. */
export function countryWeight(rec: CountryRecord | undefined): number {
  if (!rec || rec.asked === 0) return 1.5;
  const missRate = (rec.asked - rec.correct) / rec.asked;
  return 1 + 3 * missRate;
}

export function pickQuestion(bank: QuestionBank, ctx: PickContext): Question | null {
  const rng = ctx.rng ?? Math.random;
  const attempts: Array<{ avoidRecent: boolean; avoidAsked: boolean }> = [
    { avoidRecent: true, avoidAsked: true },
    { avoidRecent: false, avoidAsked: true },
    { avoidRecent: false, avoidAsked: false },
  ];
  for (const { avoidRecent, avoidAsked } of attempts) {
    const pools: Array<{ country: string; list: Question[]; weight: number }> = [];
    for (const [country, list] of bank.bySourceCountry) {
      if (avoidRecent && ctx.recentCountries.includes(country)) continue;
      const usable = list.filter((q) => passesFilters(q, ctx.filters) && !(avoidAsked && ctx.askedKeys.has(q.key)));
      if (usable.length === 0) continue;
      pools.push({ country, list: usable, weight: countryWeight(ctx.countryStats.get(country)) });
    }
    if (pools.length === 0) continue;
    const total = pools.reduce((s, p) => s + p.weight, 0);
    let r = rng() * total;
    let chosen = pools[pools.length - 1];
    for (const p of pools) {
      r -= p.weight;
      if (r <= 0) {
        chosen = p;
        break;
      }
    }
    return chosen.list[Math.floor(rng() * chosen.list.length)];
  }
  return null;
}

export function isCorrect(q: Question, guessedIso: string | null): boolean {
  return guessedIso !== null && q.answers.includes(guessedIso);
}

// ---- Coverage --------------------------------------------------------------

export function coverage(bank: QuestionBank): Map<string, number> {
  const out = new Map<string, number>();
  for (const [iso, list] of bank.byCountry) out.set(iso, list.length);
  return out;
}

// ---- "One of these" hint ----------------------------------------------------

function shuffled<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Countries to highlight for the hint: exactly one correct answer plus random others. When the clue names a
 * sub-region or region, the others come from there so the choices stay plausible.
 */
export function pickCandidates(q: Question, rng: () => number = Math.random, count = 5): string[] {
  const answer = q.answers[Math.floor(rng() * q.answers.length)];
  const others = COUNTRIES.filter((c) => !q.answers.includes(c.iso3));
  const { region, subregion } = q.constraints;
  const need = count - 1;
  const scopes = [
    subregion ? others.filter((c) => c.subregion === subregion) : null,
    region ? others.filter((c) => c.region === region) : null,
  ];
  const pool = scopes.find((sc) => sc && sc.length >= need) ?? others;
  const picked = shuffled(pool, rng)
    .slice(0, need)
    .map((c) => c.iso3);
  return shuffled([answer, ...picked], rng);
}
