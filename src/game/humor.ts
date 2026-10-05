import { SENSITIVE_TYPES, type GameEvent } from "../types";

/** Jokes aim at the player, cartography, empires and bureaucracy. Never at victims. */

export const CORRECT_LINES = [
  "Correct. Your cartography license is safe for now.",
  "Right. The empire's accountants would be impressed.",
  "Nailed it. No colonial map-makers were consulted.",
  "Correct. You clearly did the reading.",
  "Yes! Somewhere, a historian nods quietly.",
  "Correct. Gold star, ethically sourced.",
];

export const WRONG_LINES = [
  "Not quite. The map was not drawn by committee, though it sometimes feels that way.",
  "Wrong. Even the Congress of Vienna got more borders right.",
  "Missed. Borders have always been confusing, mostly on purpose.",
  "Nope. Don't worry, treaties were signed over bigger mistakes.",
  "Not that one. Consider this a geography footnote.",
  "Close, but history does not accept 'close'.",
];

export const STREAK_LINES: Record<number, string> = {
  3: "Three in a row. A small empire of correct answers.",
  5: "Five in a row. Historians are starting to take notes.",
  8: "Eight in a row. You could write the footnotes.",
  10: "Ten in a row. The Encyclopaedia called, it wants its job back.",
};

export const HINT_LINES = [
  "A hint, at a modest price. Even the Treaty of Tordesillas had a fee.",
  "Hint purchased. Receipt will be filed in triplicate.",
  "Consulting the archives. They are, as usual, disorganised.",
];

export const CANDIDATE_LINES = [
  "Five countries lit up. One of them is your answer.",
  "A shortlist of five. The answer is hiding among them.",
  "Five suspects on the map. One of them is the answer.",
];

export const LOADING_LINES = [
  "Unrolling the map...",
  "Dusting off the atlas...",
  "Consulting archives of questionable filing...",
  "Sharpening the pencils of cartographers past...",
];

export const EMPTY_LINES = [
  "No questions match these filters. Even history has gaps.",
  "Nothing to ask here yet. Try widening the filters.",
];

export const UNPLAYABLE_LINES = [
  "That patch of the map is not part of the quiz. Penguins have not been exploited, as far as we know.",
  "No question here. Pick a country with a more eventful archive.",
];

export const END_LINES: Array<[number, string]> = [
  [0.9, "Outstanding. You may now draw borders with a ruler, responsibly."],
  [0.7, "Solid work. The history department approves."],
  [0.4, "Respectable. The Congress of Vienna would have taken you on as an intern."],
  [0, "Humble beginnings. Every empire started somewhere (do not follow their example)."],
];

export function pick<T>(list: readonly T[], rng: () => number = Math.random): T {
  return list[Math.floor(rng() * list.length)];
}

export function endLine(accuracy: number): string {
  for (const [min, line] of END_LINES) if (accuracy >= min) return line;
  return END_LINES[END_LINES.length - 1][1];
}

/** A quip is shown only when allowed by the user and the event is not a sensitive one. */
export function quipFor(ev: GameEvent, quipsOn: boolean): string | null {
  if (!quipsOn || !ev.quip) return null;
  if (ev.sensitive || SENSITIVE_TYPES.includes(ev.type)) return null;
  return ev.quip;
}
