import type { EventType } from "../types";

/** Resource id -> phrase used after "for" in a question. */
export const RESOURCES: Record<string, string> = {
  rubber: "rubber",
  ivory: "ivory",
  copper: "copper",
  cobalt: "cobalt",
  diamonds: "diamonds",
  gold: "gold",
  silver: "silver",
  oil: "oil",
  natural_gas: "natural gas",
  coal: "coal",
  iron_ore: "iron ore",
  tin: "tin",
  uranium: "uranium",
  bauxite: "bauxite",
  phosphates: "phosphates",
  nitrates: "nitrates",
  guano: "guano",
  salt: "salt",
  pearls: "pearls",
  spices: "spices",
  sugar: "sugar",
  coffee: "coffee",
  cocoa: "cocoa",
  tea: "tea",
  tobacco: "tobacco",
  cotton: "cotton",
  indigo: "indigo",
  opium: "opium",
  rice: "rice",
  grain: "grain",
  palm_oil: "palm oil",
  bananas: "bananas",
  timber: "timber",
  furs: "furs",
  fish: "fish",
  wool: "wool",
  livestock: "livestock",
  labour: "cheap labour",
  slaves: "enslaved labour",
  land: "land",
  tribute: "tribute",
  strategic_location: "its strategic location",
  trade_routes: "control of trade routes",
};

export const RESOURCE_IDS = Object.keys(RESOURCES);

/** Verb phrase per event type, used only by templates where the type is a constraint. */
export const TYPE_VERBS: Record<EventType, string> = {
  colonization: "was colonized by",
  occupation: "was occupied by",
  annexation: "was annexed by",
  slave_trade: "was raided for the slave trade by",
  resource_extraction: "had its resources extracted by",
  forced_labour: "was subjected to forced labour by",
  unequal_treaty: "was forced into unequal treaties by",
  puppet_regime: "was turned into a puppet state by",
  proxy_war: "was used as a proxy battleground by",
  engineered_famine: "suffered famine under policies of",
  other: "was exploited by",
};

/** Same, without an exploiter attached ("... in the 1840s"). */
export const TYPE_NOUNS: Record<EventType, string> = {
  colonization: "was colonized",
  occupation: "was occupied",
  annexation: "was annexed",
  slave_trade: "was raided for the slave trade",
  resource_extraction: "had its resources extracted",
  forced_labour: "was subjected to forced labour",
  unequal_treaty: "was forced into unequal treaties",
  puppet_regime: "was turned into a puppet state",
  proxy_war: "was used as a proxy battleground",
  engineered_famine: "suffered an engineered famine",
  other: "was exploited",
};

export const REGION_ADJECTIVES: Record<string, string> = {
  Africa: "African",
  Asia: "Asian",
  Europe: "European",
  "North America": "North American",
  "South America": "South American",
  Oceania: "Oceanian",
};

export const SUBREGION_PHRASES: Record<string, string> = {
  "North Africa": "North African nation",
  "West Africa": "West African nation",
  "East Africa": "East African nation",
  "Central Africa": "Central African nation",
  "Southern Africa": "Southern African nation",
  "Middle East": "Middle Eastern nation",
  "Central Asia": "Central Asian nation",
  "South Asia": "South Asian nation",
  "East Asia": "East Asian nation",
  "Southeast Asia": "Southeast Asian nation",
  Caucasus: "nation in the Caucasus",
  "Western Europe": "Western European nation",
  "Eastern Europe": "Eastern European nation",
  "Southern Europe": "Southern European nation",
  "Northern Europe": "Northern European nation",
  Balkans: "Balkan nation",
  Baltics: "Baltic nation",
  "Central America": "Central American nation",
  Caribbean: "Caribbean nation",
  Melanesia: "Melanesian nation",
  Polynesia: "Polynesian nation",
  Micronesia: "Micronesian nation",
};

/** Short noun phrase per event type for hints ("the episode involved ..."). "other" is omitted on purpose. */
export const TYPE_LABELS: Partial<Record<EventType, string>> = {
  colonization: "colonization",
  occupation: "military occupation",
  annexation: "annexation",
  slave_trade: "the slave trade",
  resource_extraction: "resource extraction",
  forced_labour: "forced labour",
  unequal_treaty: "an unequal treaty",
  puppet_regime: "a puppet regime",
  proxy_war: "a proxy war",
  engineered_famine: "famine",
};
