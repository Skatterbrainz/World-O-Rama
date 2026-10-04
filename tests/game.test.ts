import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { flattenCountryFiles } from "../src/data/load";
import { centuryEra, decadeEra, eraBucket, eventEras, fmtYear, ordinal } from "../src/game/era";
import { buildQuestionBank, constraintsKey, isCorrect, matches, normName, pickQuestion, NO_FILTERS } from "../src/game/questions";
import { scoreAnswer } from "../src/game/scoring";
import { breakdown, emptyStats, parseStats, recordAnswer, rollingAccuracy, saveStats, loadStats, startSession, weakSpots, type AnswerRecord, type KeyValueStore } from "../src/game/stats";
import { quipFor } from "../src/game/humor";
import type { CountryFile, GameEvent } from "../src/types";

function ev(partial: Partial<GameEvent> & { id: string; country: string }): GameEvent {
  return {
    title: "t",
    startYear: 1900,
    endYear: 1908,
    exploiter: { label: "Belgium" },
    type: "colonization",
    resources: ["rubber"],
    summary: "x".repeat(50),
    wikipediaTitle: "x",
    sources: ["https://example.com"],
    ...partial,
  };
}

describe("era helpers", () => {
  it("formats ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th"]);
  });
  it("computes centuries incl. boundaries and BCE", () => {
    expect(centuryEra(1900)).toMatchObject({ start: 1801, end: 1900, label: "the 19th century" });
    expect(centuryEra(1901)).toMatchObject({ start: 1901, end: 2000, label: "the 20th century" });
    expect(centuryEra(-250)).toMatchObject({ start: -300, end: -201, label: "the 3rd century BCE" });
    expect(centuryEra(795).label).toBe("the 8th century");
  });
  it("computes decades", () => {
    expect(decadeEra(1963)).toMatchObject({ start: 1960, end: 1969, label: "the 1960s" });
    expect(decadeEra(1900).label).toBe("the 1900s");
  });
  it("uses decades only from 1700 on", () => {
    expect(eventEras(1556, 1556).every((e) => e.kind === "century")).toBe(true);
    expect(eventEras(1885, 1908).some((e) => e.label === "the 1900s")).toBe(true);
  });
  it("buckets eras and formats BCE years", () => {
    expect(eraBucket(300)).toBe("ancient");
    expect(eraBucket(1000)).toBe("medieval");
    expect(eraBucket(1650)).toBe("early-modern");
    expect(eraBucket(1850)).toBe("19th-century");
    expect(eraBucket(1960)).toBe("20th-century+");
    expect(fmtYear(-44)).toBe("44 BCE");
  });
});

describe("question engine", () => {
  const events = [
    ev({ id: "COD-a", country: "COD", exploiter: { label: "the Soviet Union" }, resources: ["oil"] }),
    ev({ id: "ROU-a", country: "ROU", exploiter: { label: "Soviet Union" }, resources: ["oil"], startYear: 1944, endYear: 1958 }),
    ev({ id: "COD-b", country: "COD", exploiter: { label: "Belgium" }, resources: ["rubber", "ivory"], territoryNames: ["the Congo Free State"], hints: ["Clue one.", "Clue two."] }),
  ];

  it("normalises exploiter names", () => {
    expect(normName("the Soviet Union")).toBe(normName("Soviet Union"));
  });

  it("accepts every country that fits as an answer (answer sets)", () => {
    const bank = buildQuestionBank(events);
    const q = bank.questions.find((x) => x.constraints.exploiter === "soviet union" && x.constraints.resource === "oil" && !x.constraints.region && x.template === "exploiter-resource");
    expect(q).toBeDefined();
    expect(q!.answers).toEqual(["COD", "ROU"]);
    expect(isCorrect(q!, "ROU")).toBe(true);
    expect(isCorrect(q!, "COD")).toBe(true);
    expect(isCorrect(q!, "FRA")).toBe(false);
    expect(isCorrect(q!, null)).toBe(false);
  });

  it("produces the headline question shape", () => {
    const bank = buildQuestionBank(events);
    const q = bank.questions.find((x) => x.text === "An African nation that was exploited by Belgium for rubber in the 1900s");
    expect(q?.text).toBe("An African nation that was exploited by Belgium for rubber in the 1900s");
    expect(q?.answers).toEqual(["COD"]);
  });

  it("drops questions with too many valid answers", () => {
    const many = ["COD", "ROU", "POL", "EST", "LVA"].map((c) => ev({ id: `${c}-x`, country: c, resources: ["coal"], exploiter: { label: "Nowhere" } }));
    const bank = buildQuestionBank(many, 4);
    expect(bank.tooAmbiguous.length).toBeGreaterThan(0);
    expect(bank.questions.some((q) => q.constraints.exploiter === "nowhere" && !q.constraints.region && !q.constraints.eraStart && q.constraints.resource === "coal")).toBe(false);
  });

  it("builds territory-name and authored-clue questions", () => {
    const bank = buildQuestionBank(events);
    expect(bank.questions.some((q) => q.text === "A modern nation that was once part of the Congo Free State")).toBe(true);
    const clue = bank.questions.filter((q) => q.template === "authored-clue");
    expect(clue.map((q) => q.text).sort()).toEqual(["Clue one.", "Clue two."]);
    expect(clue.find((q) => q.text === "Clue one.")!.hints).toContain("Clue two.");
  });

  it("always offers a hint ladder that never repeats the question constraints", () => {
    const bank = buildQuestionBank(events);
    const q = bank.questions.find((x) => x.text === "An African nation that was exploited by Belgium for rubber in the 1900s")!;
    expect(q.hints.length).toBeGreaterThan(0);
    expect(q.hints.length).toBeLessThanOrEqual(3);
    expect(q.hints.some((h) => h.includes("exploiter was"))).toBe(false);
    expect(q.hints.some((h) => h.includes("involved rubber"))).toBe(false);
    const withSub = bank.questions.find((x) => x.template === "subregion-exploiter-era" && x.constraints.exploiter === "belgium");
    expect(withSub?.hints.length ?? 0).toBeGreaterThan(0);
  });

  it("deduplicates identical constraints", () => {
    const bank = buildQuestionBank(events);
    const keys = bank.questions.map((q) => q.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(constraintsKey({ region: "Africa", exploiter: "belgium" })).toBe("exploiter=belgium;region=Africa");
  });

  it("matches constraints against events", () => {
    expect(matches(events[0], { region: "Africa", exploiter: "soviet union" })).toBe(true);
    expect(matches(events[0], { region: "Europe" })).toBe(false);
    expect(matches(events[1], { eraStart: 1950, eraEnd: 1959 })).toBe(true);
    expect(matches(events[1], { eraStart: 1960, eraEnd: 1969 })).toBe(false);
  });

  it("picks questions honoring filters, repeats and weights", () => {
    const bank = buildQuestionBank(events);
    const rng = () => 0.1;
    const q = pickQuestion(bank, { filters: { ...NO_FILTERS, regions: ["Europe"] }, askedKeys: new Set(), recentCountries: [], countryStats: new Map(), rng });
    expect(q).not.toBeNull();
    expect(q!.answers.some((a) => a === "ROU")).toBe(true);
    const none = pickQuestion(bank, { filters: { ...NO_FILTERS, regions: ["Oceania"] }, askedKeys: new Set(), recentCountries: [], countryStats: new Map(), rng });
    expect(none).toBeNull();
  });
});

describe("seed dataset", () => {
  const dir = join(__dirname, "..", "data", "events");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as CountryFile);
  const events = flattenCountryFiles(files);
  const bank = buildQuestionBank(events);

  it("has data and generates a healthy question bank", () => {
    expect(events.length).toBeGreaterThan(30);
    expect(bank.questions.length).toBeGreaterThan(300);
  });

  it("gives every seeded country at least 8 distinct questions", () => {
    for (const f of files) expect(bank.byCountry.get(f.country)?.length ?? 0, f.country).toBeGreaterThanOrEqual(8);
  });

  it("keeps the Congo/Belgium example answerable", () => {
    const q = bank.questions.find((x) => x.text === "An African nation that was exploited by Belgium for rubber in the 1900s");
    expect(q).toBeUndefined(); // Belgium rubber is not in the seed; the Leopold event covers it
    const q2 = bank.questions.find((x) => x.text === "An African nation that was exploited by King Leopold II for rubber in the 1900s");
    expect(q2?.answers).toEqual(["COD"]);
  });
});

describe("scoring", () => {
  it("scores correct answers by difficulty, hints and streak", () => {
    expect(scoreAnswer({ correct: true, difficulty: 1, hintsUsed: 0, streakBefore: 0 }).points).toBe(100);
    expect(scoreAnswer({ correct: true, difficulty: 3, hintsUsed: 0, streakBefore: 0 }).points).toBe(200);
    expect(scoreAnswer({ correct: true, difficulty: 2, hintsUsed: 2, streakBefore: 0 }).points).toBe(75);
    expect(scoreAnswer({ correct: true, difficulty: 1, hintsUsed: 0, streakBefore: 3 }).points).toBe(130);
    expect(scoreAnswer({ correct: true, difficulty: 1, hintsUsed: 0, streakBefore: 50 }).points).toBe(200);
  });
  it("never goes below 25% of base with max hints and resets streak on a miss", () => {
    expect(scoreAnswer({ correct: true, difficulty: 1, hintsUsed: 9, streakBefore: 0 }).points).toBe(25);
    const miss = scoreAnswer({ correct: false, difficulty: 2, hintsUsed: 0, streakBefore: 7 });
    expect(miss).toMatchObject({ points: 0, streakAfter: 0 });
  });
});

function fakeStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

function answer(correct: boolean, country = "COD", region: AnswerRecord["region"] = "Africa"): AnswerRecord {
  return { t: 0, key: "k", country, guessed: country, correct, difficulty: 1, hints: 0, points: correct ? 100 : 0, region, era: "20th-century+", exploiter: "belgium" };
}

describe("stats and trend", () => {
  it("persists and reloads", () => {
    const store = fakeStore();
    const data = emptyStats();
    const s = startSession(data, "quick", 1000);
    recordAnswer(data, s, answer(true), 1);
    recordAnswer(data, s, answer(false), 0);
    saveStats(store, data);
    const loaded = loadStats(store);
    expect(loaded.answers).toHaveLength(2);
    expect(loaded.sessions[0]).toMatchObject({ answered: 2, correct: 1, score: 100, bestStreak: 1 });
    expect(loaded.bestStreak).toBe(1);
  });
  it("ignores corrupt or foreign data", () => {
    expect(parseStats("not json").answers).toEqual([]);
    expect(parseStats(JSON.stringify({ version: 99 })).answers).toEqual([]);
    expect(parseStats(null).sessions).toEqual([]);
  });
  it("computes rolling accuracy", () => {
    const pts = rollingAccuracy([answer(true), answer(true), answer(false), answer(false)], 2);
    expect(pts.map((p) => p.value)).toEqual([1, 1, 0.5, 0]);
  });
  it("finds weak spots and breakdowns", () => {
    const data = emptyStats();
    data.answers = [answer(false, "COD"), answer(false, "COD"), answer(true, "ROU", "Europe"), answer(true, "ROU", "Europe")];
    expect(weakSpots(data)).toEqual([{ country: "COD", asked: 2, accuracy: 0 }]);
    const rows = breakdown(data.answers, (a) => a.region);
    expect(rows.find((r) => r.label === "Europe")?.accuracy).toBe(1);
  });
});

describe("humor guardrails", () => {
  it("never returns a quip for sensitive events or when quips are off", () => {
    const quipped = ev({ id: "X-1", country: "COD", quip: "joke" });
    expect(quipFor(quipped, true)).toBe("joke");
    expect(quipFor(quipped, false)).toBeNull();
    expect(quipFor({ ...quipped, sensitive: true }, true)).toBeNull();
    expect(quipFor({ ...quipped, type: "slave_trade" }, true)).toBeNull();
    expect(quipFor({ ...quipped, type: "forced_labour" }, true)).toBeNull();
  });
});
