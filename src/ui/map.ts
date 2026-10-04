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
/** Slack beyond the map edges so a zoomed-in country can be centred in the free part of the view. */
const PAN_MARGIN_X = W * 0.1;
const PAN_MARGIN_Y = H * 0.1;

type CountryFeature = Feature<Polygon | MultiPolygon, { name: string }>;

/** Pixels of the map area covered by overlays, so zoomTo can centre the target in what remains visible. */
export interface Insets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface MapHandle {
  onGuess(cb: (iso3: string | null, atlasName: string) => void): void;
  showResult(correct: string[], guessed: string | null): void;
  clearResult(): void;
  zoomTo(isos: string[], insets?: Insets): void;
  resetView(): void;
  zoomBy(factor: number): void;
  setInteractive(on: boolean): void;
  setNamesVisible(on: boolean): void;
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
  const svgNode = svg.node() as SVGSVGElement;

  const tooltip = document.createElement("div");
  tooltip.className = "map-tooltip hidden";
  container.appendChild(tooltip);

  svg.append("path").attr("class", "sphere").attr("d", path({ type: "Sphere" }) ?? "");
  const g = svg.append("g").attr("class", "viewport");

  let guessCb: (iso3: string | null, atlasName: string) => void = () => undefined;
  let interactive = true;
  let namesVisible = true;
  let dragging = false;

  const displayName = (atlasName: string): string => countryByAtlasName(atlasName)?.name ?? atlasName;
  const isoOf = (d: CountryFeature): string | null => countryByAtlasName(d.properties.name)?.iso3 ?? null;

  function moveTooltip(event: MouseEvent, d: CountryFeature): void {
    if (!namesVisible || dragging) {
      tooltip.classList.add("hidden");
      return;
    }
    const box = container.getBoundingClientRect();
    tooltip.textContent = displayName(d.properties.name);
    tooltip.classList.remove("hidden");
    const x = Math.min(event.clientX - box.left + 14, box.width - tooltip.offsetWidth - 6);
    const y = Math.max(event.clientY - box.top - tooltip.offsetHeight - 10, 4);
    tooltip.style.transform = `translate(${Math.max(x, 4)}px, ${y}px)`;
  }

  const hideTooltip = () => tooltip.classList.add("hidden");

  const countryPaths = g
    .append("g")
    .selectAll<SVGPathElement, CountryFeature>("path")
    .data(features)
    .join("path")
    .attr("class", (d) => (countryByAtlasName(d.properties.name) ? "country" : "country unplayable"))
    .attr("data-iso", (d) => isoOf(d) ?? "")
    .attr("d", (d) => path(d) ?? "")
    .on("click", (_e, d) => {
      if (!interactive) return;
      guessCb(isoOf(d), d.properties.name);
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);

  const markerData = features.filter((f) => countryByAtlasName(f.properties.name) && path.area(f) < MARKER_AREA);
  const markers = g
    .append("g")
    .selectAll<SVGCircleElement, CountryFeature>("circle")
    .data(markerData)
    .join("circle")
    .attr("class", "marker")
    .attr("data-iso", (d) => isoOf(d) ?? "")
    .attr("cx", (d) => path.centroid(d)[0])
    .attr("cy", (d) => path.centroid(d)[1])
    .attr("r", 4)
    .on("click", (_e, d) => {
      if (!interactive) return;
      guessCb(isoOf(d), d.properties.name);
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);

  const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, MAX_ZOOM])
    .translateExtent([
      [-PAN_MARGIN_X, -PAN_MARGIN_Y],
      [W + PAN_MARGIN_X, H + PAN_MARGIN_Y],
    ])
    .on("start", (event) => {
      if (event.sourceEvent && event.sourceEvent.type === "mousedown") dragging = true;
    })
    .on("zoom", (event) => {
      g.attr("transform", event.transform.toString());
      markers.attr("r", 4 / Math.sqrt(event.transform.k));
      if (dragging) hideTooltip();
    })
    .on("end", () => {
      dragging = false;
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
    zoomTo(isos, insets = {}) {
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
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;

      // Work out which part of the SVG is actually visible (not under an overlay), in viewBox units.
      const rect = svgNode.getBoundingClientRect();
      const scale = Math.min(rect.width / W, rect.height / H) || 1;
      const offX = (rect.width - W * scale) / 2;
      const offY = (rect.height - H * scale) / 2;
      const left = insets.left ?? 0;
      const top = insets.top ?? 0;
      const freeW = Math.max(rect.width - left - (insets.right ?? 0), 80);
      const freeH = Math.max(rect.height - top - (insets.bottom ?? 0), 80);
      const targetX = (left + freeW / 2 - offX) / scale;
      const targetY = (top + freeH / 2 - offY) / scale;
      const visW = freeW / scale;
      const visH = freeH / scale;

      const k = Math.min(isos.length > 1 ? 6 : 10, 0.7 / Math.max(dx / visW, dy / visH));
      svg
        .transition()
        .duration(800)
        .call(zoomBehavior.transform, zoomIdentity.translate(targetX, targetY).scale(Math.max(k, 1)).translate(-cx, -cy));
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
    setNamesVisible(on) {
      namesVisible = on;
      if (!on) hideTooltip();
    },
  };
  return api;
}
