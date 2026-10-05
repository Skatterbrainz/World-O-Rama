export type Region = "Africa" | "Asia" | "Europe" | "North America" | "South America" | "Oceania";

export interface Country {
  iso3: string;
  name: string;
  region: Region;
  subregion: string | null;
  /** True when the country has no sea coast. */
  landlocked: boolean;
  /** "whole": the country is an island or archipelago. "shared": it shares its island with another country. */
  island: "whole" | "shared" | null;
  /** Names used by the world-atlas TopoJSON for this country (some countries have several features). */
  atlasNames: string[];
}

export const EVENT_TYPES = [
  "colonization",
  "occupation",
  "annexation",
  "slave_trade",
  "resource_extraction",
  "forced_labour",
  "unequal_treaty",
  "puppet_regime",
  "proxy_war",
  "coup",
  "invasion",
  "engineered_famine",
  "other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Event types whose reveal card never gets a joke. */
export const SENSITIVE_TYPES: readonly EventType[] = ["slave_trade", "forced_labour", "engineered_famine"];

export interface Exploiter {
  /** Display label, e.g. "Belgium", "the Soviet Union", "the British Empire". */
  label: string;
}

/** Event as stored in data/events/<ISO3>.json (country is implied by the file). */
export interface RawEvent {
  id: string;
  title: string;
  startYear: number;
  /** Inclusive end year. Use the same as startYear for a single-year event. */
  endYear: number;
  exploiter: Exploiter;
  type: EventType;
  /** Resource ids from the controlled vocabulary (src/data/vocab.ts). May be empty. */
  resources: string[];
  /** Historical names for the territory, e.g. "Congo Free State". */
  territoryNames?: string[];
  /** 0-3 authored clues ordered vague to specific. They must never name the country. */
  hints?: string[];
  summary: string;
  quip?: string;
  /** Force-suppress the quip on the reveal card. */
  sensitive?: boolean;
  /** The exploiter's role is contested: question wording and hints say "allegedly". */
  alleged?: boolean;
  wikipediaTitle: string;
  sources: string[];
}

export interface CountryFile {
  country: string;
  events: RawEvent[];
}

export interface GameEvent extends RawEvent {
  country: string;
}

export interface Constraints {
  region?: Region;
  subregion?: string;
  exploiter?: string;
  resource?: string;
  type?: EventType;
  territoryName?: string;
  eraStart?: number;
  eraEnd?: number;
  eventId?: string;
  /** For authored-clue questions: which entry of the event's hints[] is the prompt. */
  hintIndex?: number;
  /** Set on exploiter questions: only events with the same alleged status match, so wording stays accurate. */
  alleged?: boolean;
}

export type EraBucket = "ancient" | "medieval" | "early-modern" | "19th-century" | "20th-century+";

export interface Question {
  /** Canonical key from the constraints: identical constraints mean the same question. */
  key: string;
  template: string;
  text: string;
  difficulty: 1 | 2 | 3;
  constraints: Constraints;
  /** All countries (ISO3) that satisfy the constraints, i.e. every accepted answer. */
  answers: string[];
  /** Event that generated this question. */
  sourceEventId: string;
  /** Country of the generating event (the "main" answer). */
  sourceCountry: string;
  /** Type and normalised exploiter of the generating event, used by the topic filter. */
  sourceType: EventType;
  sourceExploiter: string;
  /** Progressive hints, cheapest to most revealing. */
  hints: string[];
  /** Mid-year of the generating event, used for era filtering. */
  year: number;
}
