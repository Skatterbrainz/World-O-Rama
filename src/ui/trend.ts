import { countryByIso } from "../data/countries";
import { ERA_BUCKET_LABELS } from "../game/era";
import {
  breakdown,
  rollingAccuracy,
  sessionScores,
  weakSpots,
  type BreakdownRow,
  type StatsData,
  type TrendPoint,
} from "../game/stats";
import type { EraBucket } from "../types";

const NS = "http://www.w3.org/2000/svg";

/** Tiny dependency-free line chart. Returns an SVG element. */
export function lineChart(points: TrendPoint[], opts: { yMax?: number; percent?: boolean; color: string; label: string }): SVGSVGElement {
  const w = 420;
  const h = 150;
  const pad = { l: 36, r: 8, t: 10, b: 20 };
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("class", "chart");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", opts.label);

  const yMax = opts.yMax ?? Math.max(1, ...points.map((p) => p.value));
  const x = (i: number) =>
    points.length <= 1 ? pad.l + (w - pad.l - pad.r) / 2 : pad.l + ((i - points[0].index) / (points[points.length - 1].index - points[0].index)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / yMax) * (h - pad.t - pad.b);

  for (const f of [0, 0.5, 1]) {
    const gy = y(f * yMax);
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", String(pad.l));
    line.setAttribute("x2", String(w - pad.r));
    line.setAttribute("y1", String(gy));
    line.setAttribute("y2", String(gy));
    line.setAttribute("class", "grid");
    svg.appendChild(line);
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", String(pad.l - 4));
    t.setAttribute("y", String(gy + 3));
    t.setAttribute("text-anchor", "end");
    t.setAttribute("class", "tick");
    t.textContent = opts.percent ? `${Math.round(f * yMax * 100)}%` : String(Math.round(f * yMax));
    svg.appendChild(t);
  }

  if (points.length === 0) {
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", String(w / 2));
    t.setAttribute("y", String(h / 2));
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("class", "tick");
    t.textContent = "Nothing to plot yet. Play a round.";
    svg.appendChild(t);
    return svg;
  }

  const poly = document.createElementNS(NS, "polyline");
  poly.setAttribute("points", points.map((p) => `${x(p.index).toFixed(1)},${y(p.value).toFixed(1)}`).join(" "));
  poly.setAttribute("fill", "none");
  poly.setAttribute("stroke", opts.color);
  poly.setAttribute("stroke-width", "2");
  svg.appendChild(poly);
  if (points.length <= 40) {
    for (const p of points) {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", x(p.index).toFixed(1));
      c.setAttribute("cy", y(p.value).toFixed(1));
      c.setAttribute("r", "2.5");
      c.setAttribute("fill", opts.color);
      svg.appendChild(c);
    }
  }
  return svg;
}

function barRows(rows: BreakdownRow[], labelOf: (l: string) => string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "bars";
  if (rows.length === 0) {
    wrap.textContent = "No data yet.";
    return wrap;
  }
  for (const r of rows.slice(0, 8)) {
    const row = document.createElement("div");
    row.className = "bar-row";
    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = labelOf(r.label);
    const track = document.createElement("span");
    track.className = "bar-track";
    const fill = document.createElement("span");
    fill.className = "bar-fill";
    fill.style.width = `${Math.round(r.accuracy * 100)}%`;
    track.appendChild(fill);
    const num = document.createElement("span");
    num.className = "bar-num";
    num.textContent = `${Math.round(r.accuracy * 100)}% (${r.correct}/${r.asked})`;
    row.append(label, track, num);
    wrap.appendChild(row);
  }
  return wrap;
}

function section(title: string, body: Node): HTMLElement {
  const s = document.createElement("section");
  const h = document.createElement("h3");
  h.textContent = title;
  s.append(h, body);
  return s;
}

export function renderTrend(data: StatsData): HTMLElement {
  const root = document.createElement("div");
  root.className = "trend";

  const total = data.answers.length;
  const correct = data.answers.filter((a) => a.correct).length;
  const summary = document.createElement("p");
  summary.className = "trend-summary";
  summary.textContent =
    total === 0
      ? "No answers recorded yet. History is waiting."
      : `${total} answers, ${Math.round((correct / total) * 100)}% correct. Best streak ${data.bestStreak}. Best session ${data.bestSessionScore} pts.`;
  root.appendChild(summary);

  root.appendChild(
    section("Rolling accuracy (last 10 answers)", lineChart(rollingAccuracy(data.answers, 10), { yMax: 1, percent: true, color: "#4cc9a4", label: "Rolling accuracy" })),
  );
  root.appendChild(section("Score per session", lineChart(sessionScores(data), { color: "#f4b942", label: "Score per session" })));
  root.appendChild(section("Accuracy by region", barRows(breakdown(data.answers, (a) => a.region), (l) => l)));
  root.appendChild(
    section("Accuracy by era", barRows(breakdown(data.answers, (a) => a.era), (l) => ERA_BUCKET_LABELS[l as EraBucket] ?? l)),
  );
  root.appendChild(section("Accuracy by exploiter", barRows(breakdown(data.answers, (a) => a.exploiter), (l) => l)));

  const weak = weakSpots(data);
  const list = document.createElement("ul");
  list.className = "weak";
  if (weak.length === 0) {
    const li = document.createElement("li");
    li.textContent = "None yet. Suspiciously good.";
    list.appendChild(li);
  }
  for (const w of weak) {
    const li = document.createElement("li");
    li.textContent = `${countryByIso(w.country)?.name ?? w.country}: ${Math.round(w.accuracy * 100)}% over ${w.asked} questions`;
    list.appendChild(li);
  }
  root.appendChild(section("Weak spots", list));
  return root;
}
