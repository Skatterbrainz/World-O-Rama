# Data guide

World-O-Rama questions are generated from `data/events/<ISO3>.json`, one file per country. Events attach to the **modern** country covering the territory; the historical power is named in the event.

Run `npm run validate` after every change. `npm run validate -- --online` also checks that each `wikipediaTitle` exists (one batched request).

## File shape

```json
{
  "country": "COD",
  "events": [
    {
      "id": "COD-congo-free-state",
      "title": "Congo Free State",
      "startYear": 1885,
      "endYear": 1908,
      "exploiter": { "label": "King Leopold II" },
      "type": "colonization",
      "resources": ["rubber", "ivory"],
      "territoryNames": ["the Congo Free State"],
      "hints": ["vague clue", "more specific clue", "very specific clue"],
      "summary": "40-700 characters, factual, neutral.",
      "quip": "Optional dry one-liner aimed at the exploiter, never at victims.",
      "sensitive": true,
      "wikipediaTitle": "Congo Free State",
      "sources": ["https://en.wikipedia.org/wiki/Congo_Free_State"]
    }
  ]
}
```

- File name = ISO3 code from `src/data/countries.ts`; `country` must match. Event ids start with `<ISO3>-` and are unique.
- Years: integers, negative for BCE, no year 0. `endYear` is inclusive; use the same year for a single-year event.
- `type`: colonization, occupation, annexation, slave_trade, resource_extraction, forced_labour, unequal_treaty, puppet_regime, proxy_war, engineered_famine, other. Use `other` when none fits (type-based questions are skipped for it).
- `resources`: ids from `src/data/vocab.ts` (`RESOURCES`). Use as many as are genuinely accurate; each one yields extra questions. Leave empty if none applies. Do not edit `vocab.ts` (shared file); mention missing resources in your report instead.
- `territoryNames`: historical names of the territory, written as in prose including the article ("the Belgian Congo", "Dutch East Indies"). Each one yields a "which modern nation was once part of ..." question.
- `hints`: 0-3 clues ordered vague to specific. They must not contain the country name or its adjective ("Egyptian", "Haitian"). The last one should be solid enough to answer the question on its own. Hints double as the paid hint ladder.
- `sources`: https URLs. A Wikipedia article is fine; add a second reputable source when you can.

## Exploiter labels

Use one consistent label per exploiter across all files, written as in prose. A leading "the" is ignored for matching. Canonical labels already in use: Belgium, King Leopold II, France, the British Empire, England, Spain, Portugal, the Netherlands, the Dutch East India Company, the East India Company, the United States, Japan, Nazi Germany, Imperial Germany, Prussia, the Russian Empire, the Soviet Union, the Ottoman Empire, Chile, the Vikings, the Eight-Nation Alliance. Reuse them. Only introduce a new label when the actor is genuinely different.

Choose the actor responsible for the exploitation. Several powers in the same episode can be written as separate events.

## Tone and sensitivity

- Facts first, neutral wording, no contested numbers stated as certain (use "an estimated ...").
- Quips target empires, regimes, bureaucracy and hubris only.
- Never add a `quip` to events involving slavery, forced labour, famine, massacre, genocide or mass death. Set `"sensitive": true` for those. The validator rejects quips on `slave_trade`, `forced_labour`, `engineered_famine` and on events marked sensitive.

## Quality bar

- Cover as far back as records allow (ancient, medieval, early modern, colonial, 20th century, Cold War).
- Aim for at least 8 distinct questions per country (see the coverage report). More events, more resources and more territory names raise the count. Prefer real, distinct episodes over padding.
- Avoid clues that fit many countries equally well. The validator drops questions that more than 4 countries satisfy.
- If you are not confident about a fact, leave the event out or phrase it conservatively.
