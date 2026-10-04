import type { CountryFile, GameEvent } from "../types";

export function flattenCountryFiles(files: CountryFile[]): GameEvent[] {
  const out: GameEvent[] = [];
  for (const f of files) {
    for (const e of f.events) out.push({ ...e, country: f.country });
  }
  return out;
}
