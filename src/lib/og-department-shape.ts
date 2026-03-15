import { readFileSync } from "fs";
import { join } from "path";

interface GeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  properties: { code: string; nom: string };
}

interface GeoJsonCollection {
  features: GeoJsonFeature[];
}

let geojsonCache: GeoJsonCollection | null = null;

function loadGeoJson(): GeoJsonCollection {
  if (geojsonCache) return geojsonCache;
  const filePath = join(process.cwd(), "public/data/departements.geojson");
  geojsonCache = JSON.parse(readFileSync(filePath, "utf-8")) as GeoJsonCollection;
  return geojsonCache;
}

const geojson = {
  get features() {
    return loadGeoJson().features;
  },
};

type Coord = [number, number];

function getLargestRing(feature: GeoJsonFeature): Coord[] {
  if (feature.geometry.type === "Polygon") {
    return feature.geometry.coordinates[0] as Coord[];
  }
  const polygons = feature.geometry.coordinates as Coord[][][];
  let largest: Coord[] = [];
  for (const polygon of polygons) {
    const ring = polygon[0];
    if (ring && ring.length > largest.length) {
      largest = ring;
    }
  }
  return largest;
}

function projectToSvg(ring: Coord[], width: number, height: number, padding: number = 10) {
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const drawW = width - padding * 2;
  const drawH = height - padding * 2;

  const geoAspect = (maxLon - minLon) / (maxLat - minLat);
  const svgAspect = drawW / drawH;

  let scaleW = drawW;
  let scaleH = drawH;
  let offsetX = padding;
  let offsetY = padding;

  if (geoAspect > svgAspect) {
    scaleH = drawW / geoAspect;
    offsetY = padding + (drawH - scaleH) / 2;
  } else {
    scaleW = drawH * geoAspect;
    offsetX = padding + (drawW - scaleW) / 2;
  }

  const project = (lon: number, lat: number) => ({
    x: offsetX + ((lon - minLon) / (maxLon - minLon)) * scaleW,
    y: offsetY + ((maxLat - lat) / (maxLat - minLat)) * scaleH,
  });

  const svgPoints = ring.map((p) => {
    const { x, y } = project(p[0], p[1]);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const path = `M${svgPoints.join("L")}Z`;

  return { path, project };
}

export function getDepartmentSvgPath(
  code: string,
  size: { width: number; height: number } = { width: 200, height: 200 }
): string | null {
  const { features } = geojson;
  const feature = features.find((f) => f.properties.code === code);
  if (!feature) return null;

  const ring = getLargestRing(feature);
  const { path } = projectToSvg(ring, size.width, size.height);
  return path;
}

export function getDepartmentShapeDataUri(
  code: string,
  size: { width: number; height: number } = { width: 200, height: 200 },
  fill: string = "#3b82f6"
): string | null {
  const { features } = geojson;
  const feature = features.find((f) => f.properties.code === code);
  if (!feature) return null;

  const ring = getLargestRing(feature);
  const { path } = projectToSvg(ring, size.width, size.height);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.width} ${size.height}" width="${size.width}" height="${size.height}"><path d="${path}" fill="${fill}"/></svg>`;
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

export function getDepartmentShapeWithDot(
  departmentCode: string,
  communeLat: number | null,
  communeLon: number | null,
  size: { width: number; height: number } = { width: 200, height: 200 },
  options: { shapeFill?: string; dotFill?: string; dotRadius?: number } = {}
): string | null {
  const { shapeFill = "#3b82f6", dotFill = "#f97316", dotRadius = 6 } = options;

  const { features } = geojson;
  const feature = features.find((f) => f.properties.code === departmentCode);
  if (!feature) return null;

  const ring = getLargestRing(feature);
  const { path, project } = projectToSvg(ring, size.width, size.height);

  let dotSvg = "";
  if (communeLat != null && communeLon != null) {
    const { x, y } = project(communeLon, communeLat);
    dotSvg = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dotRadius}" fill="${dotFill}"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.width} ${size.height}" width="${size.width}" height="${size.height}"><path d="${path}" fill="${shapeFill}" opacity="0.3"/>${dotSvg}</svg>`;
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
