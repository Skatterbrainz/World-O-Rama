import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { select, type Selection } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldTopo from "world-atlas/countries-50m.json";
import { countryByAtlasName } from "../data/countries";

const W = 960;
const H = 500;
const MAX_ZOOM = 60;
/** Countries drawn smaller than this (in px^2 at zoom 1) also get a clickable marker. */
const MARKER_AREA = 25;

type CountryFeature = Feature<Polygon | MultiPolygon, { name: string }>;

export interface MapHandle {
  onGuess(cb: (iso3: string | null, atlasName: string) => void): void;
  showResult(correct: string[], guessed: string | null): void;
  clearResult(): void;
  zoomTo(isos: string[]): void;
  resetView(): void;
  zoomBy(factor: number): void;
  setInteractive(on: boolean): void;
}

export function createMap(container: HTMLElement): MapHandle {
  const topo = worldTopo as unknown as Topology;
  const fc = feature(topo, topo.objects.countries as GeometryCollection) as unknown as FeatureCollection<
    Polygon | MultiPolygon,
    { name: string }
  >;
  const features = fc.features as CountryFeature[];

  const projection = geoNaturalEarth1().fitExtent(
    [
      [8, 8],
      [W - 8, H - 8],
    ],
    { type: "Sphere" },
  );
  const path = geoPath(projection);

  const svg = select(container)
    .append("svg")
    .attr("class", "map-svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("role", "application")
    .attr("aria-label", "World map. Click a country to answer.")
    .attr("tabindex", 0);

  svg.append("path").attr("class", "sphere").attr("d", path({ type: "Sphere" }) ?? "");
  const g = svg.append("g").attr("class", "viewport");

  let guessCb: (iso3: string | null, atlasName: string) => void = () => undefined;
  let interactive = true;

  const countryPaths = g
    .append("g")
    .selectAll<SVGPathElement, CountryFeature>("path")
    .data(features)
    .join("path")
    .attr("class", (d) => (countryByAtlasName(d.properties.name) ? "country" : "country unplayable"))
    .attr("data-iso", (d) => countryByAtlasName(d.properties.name)?.iso3 ?? "")
    .attr("d", (d) => path(d) ?? "")
    .on("click", (_e, d) => {
      if (!interactive) return;
      guessCb(countryByAtlasName(d.properties.name)?.iso3 ?? null, d.properties.name);
    });

  const markerData = features.filter((f) => countryByAtlasName(f.properties.name) && path.area(f) < MARKER_AREA);
  const markers = g
    .append("g")
    .selectAll<SVGCircleElement, CountryFeature>("circle")
    .data(markerData)
    .join("circle")
    .attr("class", "marker")
    .attr("data-iso", (d) => countryByAtlasName(d.properties.name)?.iso3 ?? "")
    .attr("cx", (d) => path.centroid(d)[0])
    .attr("cy", (d) => path.centroid(d)[1])
    .attr("r", 4)
    .on("click", (_e, d) => {
      if (!interactive) return;
      guessCb(countryByAtlasName(d.properties.name)?.iso3 ?? null, d.properties.name);
    });

  const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, MAX_ZOOM])
    .translateExtent([
      [0, 0],
      [W, H],
    ])
    .on("zoom", (event) => {
      g.attr("transform", event.transform.toString());
      markers.attr("r", 4 / Math.sqrt(event.transform.k));
    });
  svg.call(zoomBehavior).on("dblclick.zoom", null);

  svg.on("keydown", (event: KeyboardEvent) => {
    const step = 40;
    switch (event.key) {
      case "+":
      case "=":
        api.zoomBy(1.6);
        break;
      case "-":
      case "_":
        api.zoomBy(1 / 1.6);
        break;
      case "0":
        api.resetView();
        break;
      case "ArrowLeft":
        svg.call(zoomBehavior.translateBy, step, 0);
        break;
      case "ArrowRight":
        svg.call(zoomBehavior.translateBy, -step, 0);
        break;
      case "ArrowUp":
        svg.call(zoomBehavior.translateBy, 0, step);
        break;
      case "ArrowDown":
        svg.call(zoomBehavior.translateBy, 0, -step);
        break;
      default:
        return;
    }
    event.preventDefault();
  });

  /** Bounds of a country using only its largest polygon, so USA/Russia/Fiji do not span the whole map. */
  function mainBounds(f: CountryFeature): [[number, number], [number, number]] {
    if (f.geometry.type === "Polygon") return path.bounds(f);
    let best: Feature<Polygon> | null = null;
    let bestArea = -1;
    for (const coords of f.geometry.coordinates) {
      const poly: Feature<Polygon> = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: coords } };
      const a = path.area(poly);
      if (a > bestArea) {
        bestArea = a;
        best = poly;
      }
    }
    return best ? path.bounds(best) : path.bounds(f);
  }

  function clearClasses(sel: Selection<SVGPathElement | SVGCircleElement, CountryFeature, SVGGElement, unknown>) {
    sel.classed("is-correct", false).classed("is-wrong", false);
  }

  const api: MapHandle = {
    onGuess(cb) {
      guessCb = cb;
    },
    showResult(correct, guessed) {
      api.clearResult();
      const mark = (iso: string, cls: string) => {
        g.selectAll(`[data-iso="${iso}"]`).classed(cls, true);
      };
      if (guessed && !correct.includes(guessed)) mark(guessed, "is-wrong");
      for (const iso of correct) mark(iso, "is-correct");
    },
    clearResult() {
      clearClasses(countryPaths as never);
      clearClasses(markers as never);
    },
    zoomTo(isos) {
      const fs = features.filter((f) => {
        const c = countryByAtlasName(f.properties.name);
        return c ? isos.includes(c.iso3) : false;
      });
      if (fs.length === 0) return;
      const bounds = fs.map(mainBounds);
      const x0 = Math.min(...bounds.map((b) => b[0][0]));
      const y0 = Math.min(...bounds.map((b) => b[0][1]));
      const x1 = Math.max(...bounds.map((b) => b[1][0]));
      const y1 = Math.max(...bounds.map((b) => b[1][1]));
      const dx = Math.max(x1 - x0, 1);
      const dy = Math.max(y1 - y0, 1);
      const k = Math.min(isos.length > 1 ? 6 : 10, 0.8 / Math.max(dx / W, dy / H));
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      svg
        .transition()
        .duration(800)
        .call(zoomBehavior.transform, zoomIdentity.translate(W / 2, H / 2).scale(Math.max(k, 1)).translate(-cx, -cy));
    },
    resetView() {
      svg.transition().duration(500).call(zoomBehavior.transform, zoomIdentity);
    },
    zoomBy(factor) {
      svg.transition().duration(250).call(zoomBehavior.scaleBy, factor);
    },
    setInteractive(on) {
      interactive = on;
      svg.classed("locked", !on);
    },
  };
  return api;
}
