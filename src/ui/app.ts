import { COUNTRIES, REGIONS, countryByIso } from "../data/countries";
import { EVENTS } from "../data/events";
import { ERA_BUCKET_LABELS, eraBucket, fmtYear } from "../game/era";
import {
  CORRECT_LINES,
  EMPTY_LINES,
  HINT_LINES,
  LOADING_LINES,
  STREAK_LINES,
  UNPLAYABLE_LINES,
  WRONG_LINES,
  endLine,
  pick,
  quipFor,
} from "../game/humor";
import { buildQuestionBank, isCorrect, matches, normName, pickQuestion, type Filters, type QuestionBank } from "../game/questions";
import { MAX_HINTS, scoreAnswer, HINT_PENALTY } from "../game/scoring";
import {
  countryRecords,
  exportStats,
  importStats,
  loadSettings,
  loadStats,
  recordAnswer,
  resetStats,
  saveSettings,
  saveStats,
  startSession,
  type KeyValueStore,
  type Mode,
  type SessionRecord,
  type Settings,
  type StatsData,
} from "../game/stats";
import type { EraBucket, GameEvent, Question, Region } from "../types";
import { createMap, type MapHandle } from "./map";
import { renderTrend } from "./trend";
import { fetchWikiSummary } from "./wikipedia";

const QUICK_ROUNDS = 10;
const FLAGS_KEY = "world-o-rama:flags:v1";
const DIFF_LABEL = { 1: "Easy", 2: "Medium", 3: "Hard" } as const;

function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

function getStore(): KeyValueStore {
  try {
    const s = window.localStorage;
    s.setItem("world-o-rama:probe", "1");
    s.removeItem("world-o-rama:probe");
    return s;
  } catch {
    return memoryStore();
  }
}

type Child = Node | string | null | undefined | false;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") e.className = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) if (c) e.append(c);
  return e;
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = el("a", { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface GameState {
  mode: Mode;
  session: SessionRecord;
  round: number;
  score: number;
  streak: number;
  correct: number;
  current: Question | null;
  hintsUsed: number;
  answered: boolean;
  askedKeys: Set<string>;
  recent: string[];
}

export function startApp(root: HTMLElement): void {
  const store = getStore();
  let stats: StatsData = loadStats(store);
  let settings: Settings = loadSettings(store);
  // Built after the first paint (about a second for the full dataset); empty until then.
  let bank: QuestionBank = { questions: [], byCountry: new Map(), bySourceCountry: new Map(), tooAmbiguous: [] };
  const eventsById = new Map<string, GameEvent>(EVENTS.map((e) => [e.id, e]));

  // ---- DOM skeleton -------------------------------------------------------
  const scoreChip = el("span", { class: "chip-val" }, "0");
  const streakChip = el("span", { class: "chip-val" }, "0");
  const roundChip = el("span", { class: "chip-val" }, "-");
  const btnNew = el("button", { class: "btn primary", type: "button" }, "New game");
  const btnTrend = el("button", { class: "btn", type: "button" }, "Trend");
  const btnSettings = el("button", { class: "btn", type: "button" }, "Settings");

  const header = el(
    "header",
    { class: "topbar" },
    el("div", { class: "brand" }, el("h1", {}, "World-O-Rama"), el("p", {}, "Who exploited whom? A map quiz with a dry sense of humor.")),
    el(
      "div",
      { class: "chips" },
      el("div", { class: "chip" }, "Score ", scoreChip),
      el("div", { class: "chip" }, "Streak ", streakChip),
      el("div", { class: "chip" }, "Round ", roundChip),
    ),
    el("div", { class: "actions" }, btnNew, btnTrend, btnSettings),
  );

  const clueLabel = el("div", { class: "clue-label" }, "Click on:");
  const clueText = el("p", { class: "clue-text" }, "");
  const diffBadge = el("span", { class: "badge" }, "");
  const hintBtn = el("button", { class: "btn small", type: "button" }, "Hint");
  const hintList = el("ul", { class: "hint-list" });
  const questionBar = el(
    "div",
    { class: "question-bar" },
    el(
      "div",
      { class: "qb-main" },
      el("div", { class: "qb-text" }, clueLabel, clueText),
      el("div", { class: "qb-side" }, diffBadge, hintBtn),
    ),
    hintList,
  );

  const zoomIn = el("button", { class: "btn icon", type: "button", "aria-label": "Zoom in" }, "+");
  const zoomOut = el("button", { class: "btn icon", type: "button", "aria-label": "Zoom out" }, "\u2212");
  const zoomReset = el("button", { class: "btn icon", type: "button", "aria-label": "Reset view" }, "\u2302");
  const mapControls = el("div", { class: "map-controls" }, zoomIn, zoomOut, zoomReset);
  const toast = el("div", { class: "toast hidden", role: "status" });
  const mapHost = el("div", { class: "map-host" });
  const reveal = el("aside", { class: "reveal hidden", "aria-live": "polite" });
  const mapWrap = el("div", { class: "map-wrap" }, mapHost, mapControls, toast, reveal);
  const main = el("main", { class: "main" }, questionBar, mapWrap);
  const footer = el(
    "footer",
    { class: "foot" },
    "Curated and non-exhaustive. Events are attached to the modern country covering the territory, with the historical power named in the card. Spotted an error? Use the report button on a reveal card.",
  );
  const trendDlg = el("dialog", { class: "dlg" });
  const settingsDlg = el("dialog", { class: "dlg" });
  const endDlg = el("dialog", { class: "dlg" });

  root.append(el("div", { class: "app" }, header, main, footer), trendDlg, settingsDlg, endDlg);

  const map: MapHandle = createMap(mapHost);
  map.setNamesVisible(settings.showNames);

  // ---- State --------------------------------------------------------------
  let game: GameState | null = null;
  let toastTimer: number | undefined;

  function showToast(msg: string, ms = 2600): void {
    toast.textContent = msg;
    toast.classList.remove("hidden");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.add("hidden"), ms);
  }

  function filters(): Filters {
    return { regions: settings.regions, eras: settings.eras, difficulties: settings.difficulties };
  }

  function updateChips(): void {
    if (!game) return;
    scoreChip.textContent = String(game.score);
    streakChip.textContent = `${game.streak} (best ${stats.bestStreak})`;
    roundChip.textContent = game.mode === "quick" ? `${Math.min(game.round + (game.answered ? 0 : 1), QUICK_ROUNDS)}/${QUICK_ROUNDS}` : `${game.round + (game.answered ? 0 : 1)}`;
  }

  function startGame(mode: Mode): void {
    if (bank.questions.length === 0) {
      clueText.textContent = "No questions available yet. Add data files under data/events.";
      return;
    }
    settings.mode = mode;
    saveSettings(store, settings);
    const session = startSession(stats, mode);
    game = { mode, session, round: 0, score: 0, streak: 0, correct: 0, current: null, hintsUsed: 0, answered: false, askedKeys: new Set(), recent: [] };
    saveStats(store, stats);
    nextQuestion();
  }

  function nextQuestion(): void {
    if (!game) return;
    if (game.mode === "quick" && game.round >= QUICK_ROUNDS) {
      endGame();
      return;
    }
    const q = pickQuestion(bank, {
      filters: filters(),
      askedKeys: game.askedKeys,
      recentCountries: game.recent,
      countryStats: countryRecords(stats),
    });
    reveal.classList.add("hidden");
    map.clearResult();
    map.resetView();
    if (!q) {
      game.current = null;
      clueText.textContent = pick(EMPTY_LINES);
      diffBadge.textContent = "";
      hintBtn.disabled = true;
      hintList.replaceChildren();
      map.setInteractive(false);
      return;
    }
    game.current = q;
    game.answered = false;
    game.hintsUsed = 0;
    game.askedKeys.add(q.key);
    game.recent.push(q.sourceCountry);
    if (game.recent.length > 4) game.recent.shift();
    clueText.textContent = q.text;
    diffBadge.textContent = DIFF_LABEL[q.difficulty];
    diffBadge.className = `badge d${q.difficulty}`;
    hintList.replaceChildren();
    updateHintBtn();
    map.setInteractive(true);
    updateChips();
  }

  function updateHintBtn(): void {
    if (!game?.current) return;
    const left = Math.min(game.current.hints.length, MAX_HINTS) - game.hintsUsed;
    hintBtn.disabled = game.answered || left <= 0;
    const total = Math.min(game.current.hints.length, MAX_HINTS);
    hintBtn.textContent = left > 0 ? `Hint (-${Math.round(HINT_PENALTY * 100)}%)` : total === 0 ? "No hints for this one" : "No more hints";
  }

  function revealHint(): void {
    if (!game?.current || game.answered) return;
    const h = game.current.hints[game.hintsUsed];
    if (!h) return;
    game.hintsUsed += 1;
    hintList.appendChild(el("li", {}, h));
    showToast(pick(HINT_LINES));
    updateHintBtn();
  }

  function endGame(): void {
    if (!game) return;
    const s = game.session;
    const acc = s.answered ? s.correct / s.answered : 0;
    endDlg.replaceChildren(
      el("h2", {}, "Round complete"),
      el("p", { class: "big" }, `${s.score} points`),
      el("p", {}, `${s.correct}/${s.answered} correct (${Math.round(acc * 100)}%). Best streak this round: ${s.bestStreak}.`),
      el("p", { class: "quip" }, endLine(acc)),
      el(
        "div",
        { class: "dlg-actions" },
        (() => {
          const b = el("button", { class: "btn primary", type: "button" }, "Play again");
          b.onclick = () => {
            endDlg.close();
            startGame(game?.mode ?? "quick");
          };
          return b;
        })(),
        (() => {
          const b = el("button", { class: "btn", type: "button" }, "View trend");
          b.onclick = () => {
            endDlg.close();
            openTrend();
          };
          return b;
        })(),
      ),
    );
    endDlg.showModal();
  }

  function eventFor(q: Question, guessed: string | null): GameEvent | undefined {
    if (guessed && q.answers.includes(guessed)) {
      const hit = EVENTS.find((e) => e.country === guessed && matches(e, q.constraints));
      if (hit) return hit;
    }
    return eventsById.get(q.sourceEventId);
  }

  function onGuess(iso: string | null): void {
    if (!game || !game.current || game.answered) return;
    if (iso === null) {
      showToast(pick(UNPLAYABLE_LINES));
      return;
    }
    const q = game.current;
    const ok = isCorrect(q, iso);
    const result = scoreAnswer({ correct: ok, difficulty: q.difficulty, hintsUsed: game.hintsUsed, streakBefore: game.streak });
    game.answered = true;
    game.streak = result.streakAfter;
    game.score += result.points;
    if (ok) game.correct += 1;
    game.round += 1;

    const ev = eventFor(q, iso);
    const country = countryByIso(q.sourceCountry);
    recordAnswer(
      stats,
      game.session,
      {
        t: Date.now(),
        key: q.key,
        country: q.sourceCountry,
        guessed: iso,
        correct: ok,
        difficulty: q.difficulty,
        hints: game.hintsUsed,
        points: result.points,
        region: country?.region ?? ("Africa" as Region),
        era: eraBucket(q.year),
        exploiter: ev ? normName(ev.exploiter.label) : "unknown",
      },
      result.streakAfter,
    );
    saveStats(store, stats);

    map.setInteractive(false);
    map.showResult(q.answers, iso);
    updateHintBtn();
    updateChips();
    renderReveal(q, ev, iso, ok, result);
    map.zoomTo(ok ? [iso] : q.answers, revealInsets());
  }

  /** Area of the map covered by the reveal overlay, so the zoom centres in what is still visible. */
  function revealInsets(): { right?: number; bottom?: number } {
    const m = mapWrap.getBoundingClientRect();
    const r = reveal.getBoundingClientRect();
    if (r.width === 0) return {};
    return r.width > m.width * 0.8 ? { bottom: m.bottom - r.top + 8 } : { right: m.right - r.left + 8 };
  }

  function renderReveal(q: Question, ev: GameEvent | undefined, guessed: string, ok: boolean, result: ReturnType<typeof scoreAnswer>): void {
    const guessedName = countryByIso(guessed)?.name ?? guessed;
    const answerNames = q.answers.map((a) => countryByIso(a)?.name ?? a);
    const streakLine = ok ? STREAK_LINES[result.streakAfter] : undefined;

    const head = el(
      "div",
      { class: `verdict ${ok ? "ok" : "bad"}` },
      el("strong", {}, ok ? "Correct" : "Not quite"),
      ` ${ok ? `+${result.points} pts` : "0 pts"}`,
    );
    const lines = el("p", { class: "banter" }, pick(ok ? CORRECT_LINES : WRONG_LINES));
    const answerLine = el(
      "p",
      { class: "answer" },
      ok ? `${guessedName} it is.` : `You picked ${guessedName}. The answer: ${answerNames.join(" or ")}.`,
    );
    if (ok && answerNames.length > 1) {
      answerLine.append(` Also accepted: ${q.answers.filter((a) => a !== guessed).map((a) => countryByIso(a)?.name ?? a).join(", ")}.`);
    }
    const breakdownLine =
      ok && (result.hintPenalty > 0 || result.streakBonus > 0)
        ? el("p", { class: "muted" }, `Base ${result.basePoints}${result.hintPenalty ? `, hints -${result.hintPenalty}` : ""}${result.streakBonus ? `, streak +${result.streakBonus}` : ""}.`)
        : null;

    const evBlock: Node[] = [];
    if (ev) {
      const span = ev.startYear === ev.endYear ? fmtYear(ev.startYear) : `${fmtYear(ev.startYear)} to ${fmtYear(ev.endYear)}`;
      evBlock.push(
        el("h3", {}, ev.title),
        el("p", { class: "meta" }, `${countryByIso(ev.country)?.name ?? ev.country} \u00b7 ${span} \u00b7 ${ev.alleged ? "allegedly " : ""}${ev.exploiter.label}`),
        el("p", {}, ev.summary),
      );
      const quip = quipFor(ev, settings.quips);
      if (quip) evBlock.push(el("p", { class: "quip" }, quip));
    }
    const wikiBox = el("div", { class: "wiki" });
    const links = el("p", { class: "links" });
    if (ev) {
      const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(ev.wikipediaTitle.replace(/ /g, "_"))}`;
      links.append(el("a", { href: wikiUrl, target: "_blank", rel: "noopener noreferrer" }, "Wikipedia"));
      for (const s of ev.sources) {
        let host = s;
        try {
          host = new URL(s).hostname.replace(/^www\./, "");
        } catch {
          /* keep raw */
        }
        links.append(" \u00b7 ", el("a", { href: s, target: "_blank", rel: "noopener noreferrer" }, host));
      }
      void fetchWikiSummary(ev.wikipediaTitle).then((w) => {
        if (!w || !reveal.isConnected) return;
        wikiBox.replaceChildren(
          ...(w.thumbnail ? [el("img", { src: w.thumbnail, alt: "", class: "thumb", loading: "lazy" })] : []),
          el("p", { class: "extract" }, w.extract),
        );
      });
    }

    const nextBtn = el("button", { class: "btn primary", type: "button" }, game && game.mode === "quick" && game.round >= QUICK_ROUNDS ? "Finish" : "Next question");
    nextBtn.onclick = nextQuestion;
    const flagBtn = el("button", { class: "btn small subtle", type: "button" }, "Report this question");
    flagBtn.onclick = () => {
      const flags = JSON.parse(store.getItem(FLAGS_KEY) ?? "[]") as unknown[];
      flags.push({ t: Date.now(), key: q.key, text: q.text, event: ev?.id });
      store.setItem(FLAGS_KEY, JSON.stringify(flags));
      flagBtn.textContent = "Flagged (export in Settings)";
      flagBtn.disabled = true;
    };

    const parts: Array<Node | null> = [
      head,
      lines,
      answerLine,
      breakdownLine,
      streakLine ? el("p", { class: "streak" }, streakLine) : null,
      ...evBlock,
      wikiBox,
      links,
      el("div", { class: "reveal-actions" }, nextBtn, flagBtn),
    ];
    reveal.replaceChildren(...parts.filter((n): n is Node => n !== null));
    reveal.classList.remove("hidden");
    nextBtn.focus();
  }

  // ---- Dialogs ------------------------------------------------------------
  function openTrend(): void {
    const close = el("button", { class: "btn", type: "button" }, "Close");
    close.onclick = () => trendDlg.close();
    trendDlg.replaceChildren(el("h2", {}, "Your trend"), renderTrend(stats), el("div", { class: "dlg-actions" }, close));
    trendDlg.showModal();
  }

  function checkboxGroup<T extends string | number>(name: string, items: Array<[T, string]>, selected: T[] | null): { node: HTMLElement; read: () => T[] | null } {
    const boxes: Array<[T, HTMLInputElement]> = [];
    const node = el("fieldset", {}, el("legend", {}, name));
    for (const [value, label] of items) {
      const cb = el("input", { type: "checkbox" });
      cb.checked = selected === null || selected.includes(value);
      boxes.push([value, cb]);
      node.append(el("label", { class: "check" }, cb, ` ${label}`));
    }
    return {
      node,
      read: () => {
        const on = boxes.filter(([, b]) => b.checked).map(([v]) => v);
        return on.length === boxes.length || on.length === 0 ? null : on;
      },
    };
  }

  function openSettings(): void {
    const modeSel = el("select", {});
    for (const [v, l] of [["quick", "Quick round (10)"], ["endless", "Endless"]] as const) {
      const o = el("option", { value: v }, l);
      if (settings.mode === v) o.selected = true;
      modeSel.append(o);
    }
    const regionG = checkboxGroup<Region>("Regions", REGIONS.map((r) => [r, r]), settings.regions);
    const eraG = checkboxGroup<EraBucket>(
      "Eras",
      (Object.keys(ERA_BUCKET_LABELS) as EraBucket[]).map((k) => [k, ERA_BUCKET_LABELS[k]]),
      settings.eras,
    );
    const diffG = checkboxGroup<number>("Difficulty", [[1, "Easy"], [2, "Medium"], [3, "Hard"]], settings.difficulties);
    const quips = el("input", { type: "checkbox" });
    quips.checked = settings.quips;
    const names = el("input", { type: "checkbox" });
    names.checked = settings.showNames;

    const exportBtn = el("button", { class: "btn small", type: "button" }, "Export stats");
    exportBtn.onclick = () => download("world-o-rama-stats.json", exportStats(stats));
    const exportFlags = el("button", { class: "btn small", type: "button" }, "Export flagged questions");
    exportFlags.onclick = () => download("world-o-rama-flags.json", store.getItem(FLAGS_KEY) ?? "[]");
    const importInput = el("input", { type: "file", accept: "application/json", class: "hidden" });
    const importBtn = el("button", { class: "btn small", type: "button" }, "Import stats");
    importBtn.onclick = () => importInput.click();
    importInput.onchange = async () => {
      const f = importInput.files?.[0];
      if (!f) return;
      const imported = importStats(await f.text());
      if (!imported) {
        showToast("That file did not look like World-O-Rama stats.");
        return;
      }
      stats = imported;
      saveStats(store, stats);
      showToast("Stats imported.");
      startGame(settings.mode);
    };
    const resetBtn = el("button", { class: "btn small danger", type: "button" }, "Reset all stats");
    resetBtn.onclick = () => {
      if (window.confirm("Erase all stats? This cannot be undone.")) {
        stats = resetStats(store);
        showToast("Stats erased. History starts fresh.");
        startGame(settings.mode);
      }
    };

    const save = el("button", { class: "btn primary", type: "button" }, "Save and start");
    save.onclick = () => {
      settings = {
        quips: quips.checked,
        showNames: names.checked,
        mode: modeSel.value as Mode,
        regions: regionG.read(),
        eras: eraG.read(),
        difficulties: diffG.read() as (1 | 2 | 3)[] | null,
      };
      saveSettings(store, settings);
      map.setNamesVisible(settings.showNames);
      settingsDlg.close();
      startGame(settings.mode);
    };
    const cancel = el("button", { class: "btn", type: "button" }, "Cancel");
    cancel.onclick = () => settingsDlg.close();

    settingsDlg.replaceChildren(
      el("h2", {}, "Settings"),
      el("label", { class: "row" }, "Mode ", modeSel),
      regionG.node,
      eraG.node,
      diffG.node,
      el("label", { class: "check" }, quips, " Show quips on reveal cards (never on sensitive events)"),
      el("label", { class: "check" }, names, " Show country names when hovering over the map"),
      el("div", { class: "row wrap" }, exportBtn, importBtn, importInput, exportFlags, resetBtn),
      el("p", { class: "muted" }, `${EVENTS.length} events, ${bank.questions.length} questions across ${COUNTRIES.filter((c) => bank.byCountry.has(c.iso3)).length} countries.`),
      el("div", { class: "dlg-actions" }, save, cancel),
    );
    settingsDlg.showModal();
  }

  // ---- Wiring -------------------------------------------------------------
  map.onGuess((iso) => onGuess(iso));
  hintBtn.onclick = revealHint;
  btnNew.onclick = () => startGame(settings.mode);
  btnTrend.onclick = openTrend;
  btnSettings.onclick = openSettings;
  zoomIn.onclick = () => map.zoomBy(1.6);
  zoomOut.onclick = () => map.zoomBy(1 / 1.6);
  zoomReset.onclick = () => map.resetView();
  window.addEventListener("keydown", (e) => {
    const dialogOpen = trendDlg.open || settingsDlg.open || endDlg.open;
    if (dialogOpen) return;
    if (e.key === "Enter" && game?.answered) {
      e.preventDefault();
      nextQuestion();
    } else if ((e.key === "h" || e.key === "H") && !hintBtn.disabled) {
      revealHint();
    }
  });

  clueText.textContent = pick(LOADING_LINES);
  hintBtn.disabled = true;
  map.setInteractive(false);
  window.setTimeout(() => {
    bank = buildQuestionBank(EVENTS);
    startGame(settings.mode);
  }, 30);
}
