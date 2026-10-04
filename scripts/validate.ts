/**
 * Validates data/events/*.json and prints a question coverage report.
 *
 *   npm run validate                 schema + ambiguity + coverage (warnings for low coverage)
 *   npm run validate -- --strict     low coverage becomes an error
 *   npm run validate -- --target=6   change the per-country question target (default 8)
 *   npm run validate -- --online     also check that every Wikipedia title resolves (slow, polite)
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { COUNTRIES, countryByIso } from "../src/data/countries";
import { flattenCountryFiles } from "../src/data/load";
import { RESOURCES } from "../src/data/vocab";
import { buildQuestionBank, normName } from "../src/game/questions";
import { EVENT_TYPES, SENSITIVE_TYPES, type CountryFile, type RawEvent } from "../src/types";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const online = args.includes("--online");
const target = Number(args.find((a) => a.startsWith("--target="))?.split("=")[1] ?? 8);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "data", "events");

const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);
const warn = (m: string) => warnings.push(m);

const files: CountryFile[] = [];
for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
  const iso = f.replace(/\.json$/, "");
  let data: CountryFile;
  try {
    data = JSON.parse(readFileSync(join(dir, f), "utf8")) as CountryFile;
  } catch (e) {
    err(`${f}: invalid JSON (${(e as Error).message})`);
    continue;
  }
  if (data.country !== iso) err(`${f}: "country" is "${data.country}" but the file name says ${iso}`);
  const country = countryByIso(iso);
  if (!country) {
    err(`${f}: unknown ISO3 code ${iso} (see src/data/countries.ts)`);
    continue;
  }
  if (!Array.isArray(data.events)) {
    err(`${f}: "events" must be an array`);
    continue;
  }
  files.push(data);
}

const ids = new Set<string>();
const isUrl = (s: string) => /^https:\/\/[^\s]+$/.test(s);

function checkEvent(iso: string, e: RawEvent): void {
  const where = `${iso}/${e?.id ?? "?"}`;
  const country = countryByIso(iso)!;
  if (!e.id || typeof e.id !== "string") {
    err(`${where}: missing id`);
    return;
  }
  if (!e.id.startsWith(`${iso}-`)) err(`${where}: id must start with "${iso}-"`);
  if (ids.has(e.id)) err(`${where}: duplicate id`);
  ids.add(e.id);
  if (!e.title?.trim()) err(`${where}: missing title`);
  if (!Number.isInteger(e.startYear) || !Number.isInteger(e.endYear)) err(`${where}: startYear/endYear must be integers`);
  else {
    if (e.startYear === 0 || e.endYear === 0) err(`${where}: there is no year 0 (use negative numbers for BCE)`);
    if (e.startYear > e.endYear) err(`${where}: startYear is after endYear`);
    if (e.endYear > new Date().getFullYear()) err(`${where}: endYear is in the future`);
  }
  if (!e.exploiter?.label?.trim()) err(`${where}: missing exploiter.label`);
  if (!EVENT_TYPES.includes(e.type)) err(`${where}: invalid type "${e.type}"`);
  if (!Array.isArray(e.resources)) err(`${where}: resources must be an array (may be empty)`);
  else for (const r of e.resources) if (!(r in RESOURCES)) err(`${where}: unknown resource "${r}" (see src/data/vocab.ts)`);
  if (e.territoryNames && (!Array.isArray(e.territoryNames) || e.territoryNames.some((n) => !n?.trim())))
    err(`${where}: territoryNames must be non-empty strings`);
  const hints = e.hints ?? [];
  if (!Array.isArray(hints) || hints.length > 3) err(`${where}: hints must be an array of at most 3 strings`);
  const forbidden = [country.name, ...country.atlasNames].map((n) => n.toLowerCase());
  for (const h of hints) {
    if (!h?.trim()) err(`${where}: empty hint`);
    else if (forbidden.some((n) => n.length > 3 && h.toLowerCase().includes(n))) err(`${where}: hint gives away the country: "${h}"`);
  }
  if (!e.summary || e.summary.length < 40 || e.summary.length > 700) err(`${where}: summary must be 40-700 characters`);
  if (e.quip) {
    if (e.quip.length > 180) err(`${where}: quip longer than 180 characters`);
    if (e.sensitive || SENSITIVE_TYPES.includes(e.type)) err(`${where}: quips are not allowed on sensitive events (${e.type})`);
  }
  if (!e.wikipediaTitle?.trim()) err(`${where}: missing wikipediaTitle`);
  if (!Array.isArray(e.sources) || e.sources.length < 1) err(`${where}: at least one source URL is required`);
  else for (const s of e.sources) if (!isUrl(s)) err(`${where}: source is not an https URL: ${s}`);
}

for (const f of files) for (const e of f.events) checkEvent(f.country, e);

// ---- Question bank, ambiguity, coverage -----------------------------------
const events = flattenCountryFiles(files);
const bank = buildQuestionBank(events);

console.log(`Events: ${events.length} across ${files.length} countries`);
console.log(`Questions: ${bank.questions.length} playable, ${bank.tooAmbiguous.length} dropped as ambiguous (>4 valid answers)`);

const byTemplate = new Map<string, number>();
for (const q of bank.questions) byTemplate.set(q.template, (byTemplate.get(q.template) ?? 0) + 1);
console.log("By template: " + [...byTemplate.entries()].map(([k, v]) => `${k}=${v}`).join(", "));

if (bank.tooAmbiguous.length) {
  console.log("\nSample ambiguous questions (rewrite the data or add more specific resources/territoryNames):");
  for (const q of bank.tooAmbiguous.slice(0, 5)) console.log(`  [${q.answers.length} answers] ${q.text}`);
}

const below: string[] = [];
for (const f of files) {
  const n = bank.byCountry.get(f.country)?.length ?? 0;
  if (n < target) below.push(`${countryByIso(f.country)!.name} (${f.country}): ${n}`);
}
if (below.length) {
  const msg = `${below.length} countries below the target of ${target} questions:\n  ${below.join("\n  ")}`;
  strict ? err(msg) : warn(msg);
}
const noData = COUNTRIES.filter((c) => !files.some((f) => f.country === c.iso3));
console.log(`\nCountries with data: ${files.length}/${COUNTRIES.length}. Without data: ${noData.length} (they appear only as map distractors).`);

// ---- Exploiter label hygiene ----------------------------------------------
const exploiters = new Map<string, Set<string>>();
for (const e of events) {
  const k = normName(e.exploiter.label);
  if (!exploiters.has(k)) exploiters.set(k, new Set());
  exploiters.get(k)!.add(e.exploiter.label);
}
for (const [k, labels] of exploiters) if (labels.size > 1) warn(`exploiter "${k}" is written ${labels.size} ways: ${[...labels].join(" | ")}`);
const keys = [...exploiters.keys()];
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
for (let i = 0; i < keys.length; i++)
  for (let j = i + 1; j < keys.length; j++)
    if (editDistance(keys[i], keys[j]) <= 2) warn(`possible duplicate exploiters (typo?): "${keys[i]}" and "${keys[j]}"`);
console.log(`Exploiters used: ${keys.length}`);

// ---- Optional: Wikipedia title check --------------------------------------
async function fetchWithBackoff(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "world-o-rama-validate/0.1 (local dataset check)" } });
    if (res.status !== 429 && res.status < 500) return res;
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt;
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 60000)));
  }
  return null;
}

async function checkWikipedia(): Promise<void> {
  const titles = [...new Set(events.map((e) => e.wikipediaTitle))];
  console.log(`\nChecking ${titles.length} Wikipedia titles (batched, with backoff)...`);
  let unchecked = 0;
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40);
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&titles=${encodeURIComponent(batch.join("|"))}`;
    try {
      const res = await fetchWithBackoff(url);
      if (!res || !res.ok) {
        unchecked += batch.length;
        continue;
      }
      const data = (await res.json()) as {
        query?: { pages?: Record<string, { title: string; missing?: string }>; normalized?: Array<{ from: string; to: string }>; redirects?: Array<{ from: string; to: string }> };
      };
      const map = new Map<string, string>();
      for (const n of data.query?.normalized ?? []) map.set(n.from, n.to);
      const redirect = new Map<string, string>();
      for (const r of data.query?.redirects ?? []) redirect.set(r.from, r.to);
      const missing = new Set(Object.values(data.query?.pages ?? {}).filter((p) => "missing" in p).map((p) => p.title));
      for (const t of batch) {
        let resolved = map.get(t) ?? t;
        resolved = redirect.get(resolved) ?? resolved;
        if (missing.has(resolved)) err(`Wikipedia title does not exist: ${t}`);
      }
    } catch (e) {
      unchecked += batch.length;
      warn(`could not reach Wikipedia: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(unchecked ? `UNCHECKED: ${unchecked} of ${titles.length} titles could not be verified (rate limited). Re-run later.` : `All ${titles.length} titles checked.`);
  if (unchecked) warn(`${unchecked} Wikipedia titles unchecked`);
}

async function main(): Promise<void> {
  if (online) await checkWikipedia();
  for (const w of warnings) console.warn(`WARN  ${w}`);
  for (const e of errors) console.error(`ERROR ${e}`);
  console.log(`\n${errors.length} errors, ${warnings.length} warnings`);
  process.exit(errors.length ? 1 : 0);
}

void main();
