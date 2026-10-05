import type { CountryFile } from "../types";
import { flattenCountryFiles } from "./load";

const modules = import.meta.glob("../../data/events/*.json", { eager: true, import: "default" }) as Record<
  string,
  CountryFile
>;

export const EVENTS = flattenCountryFiles(Object.values(modules));
