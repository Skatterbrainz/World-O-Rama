/**
 * Draws the app icon (a globe from the same Natural Earth data as the game, with one country highlighted)
 * and writes build/icon.svg. Convert to PNG with ImageMagick:
 *
 *   node scripts/make-icon.mjs
 *   convert -background none -density 288 build/icon.svg -resize 512x512 -depth 8 build/icon.png
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const topo = require("world-atlas/countries-110m.json");
const countries = feature(topo, topo.objects.countries).features;

const SIZE = 512;
const C = SIZE / 2;
const R = 214;

const projection = geoOrthographic().rotate([-22, -4]).scale(R).translate([C, C]).clipAngle(90);
const path = geoPath(projection);

const land = countries
  .map((f) => {
    const d = path(f);
    if (!d) return "";
    const highlight = f.properties.name === "Dem. Rep. Congo";
    return `<path d="${d}" fill="${highlight ? "#f4b942" : "#9fb2d0"}" stroke="#10243d" stroke-width="1.4" stroke-linejoin="round"/>`;
  })
  .join("\n    ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" rx="104" fill="#0e1420"/>
  <circle cx="${C}" cy="${C}" r="${R}" fill="#143a63" stroke="#f4b942" stroke-width="9"/>
  <g>
    ${land}
  </g>
</svg>
`;

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "build");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "icon.svg"), svg);
console.log("wrote build/icon.svg");
