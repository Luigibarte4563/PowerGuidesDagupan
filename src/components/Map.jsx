import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import clsx from 'clsx';
import { DEFAULT_CENTER } from '@/utils/formatters';

// leaflet.heat registers against the bare global L, which bundler-ESM leaflet
// does not set — bind the npm leaflet instance to the global L once at module
// scope so leaflet-heat.js (a deferred global script) patches the exact object
// HeatLayer imports. Unconditional: keep a single source of truth for `L`.
window.L = L;
/**
 * Basemap provider - OpenStreetMap light tiles.
 *
 * Uses the standard OSM tile server directly with a soft, desaturated filter
 * applied via CSS on .leaflet-tile-pane only.
 */
const TILE_PROVIDERS = [
  {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
];

/**
 * Basemap layer that falls over to the next provider when the current one is
 * genuinely unreachable. Catches server/network faults only - a provider that
 * answers 200 with a placeholder tile cannot be detected from the browser, which
 * is why `TILE_PROVIDERS` is curated instead.
 */
function BaseLayer() {
  const [index, setIndex] = useState(0);
  const failures = useRef(0);
  const provider = TILE_PROVIDERS[index];
  const isLast = index === TILE_PROVIDERS.length - 1;

  const handleError = useCallback(() => {
    if (isLast) return;
    failures.current += 1;
    if (failures.current < 3) return;
    failures.current = 0;
    setIndex((current) => Math.min(current + 1, TILE_PROVIDERS.length - 1));
  }, [isLast]);

  return (
    <TileLayer
      // Remounting on a URL change clears the already-broken tile placeholders.
      key={provider.url}
      url={provider.url}
      attribution={provider.attribution}
      eventHandlers={{ tileerror: handleError }}
      maxZoom={19}
    />
  );
}

/** Dark outline drawn outside the light ring so pins stay visible on pale tiles. */
const PIN_OUTLINE = '#0B1B26';

const PIN_COLORS = {
  primary: '#f18f01',
  danger: '#FF2E1F',
  warning: '#FFBB02',
  success: '#34FB34',
  info: '#00E5FF',
  neutral: '#9CA3AF',
  // Semantic aliases for the four pulsing pin colors
  green: '#34FB34',
  yellow: '#FFBB02',
  red: '#FF2E1F',
  cyan: '#00E5FF',
};

/** Specific colours for every map-legend category, so no two categories share a swatch by accident. */
export const SEVERITY_COLORS = {
  low: '#34FB34',
  moderate: '#F59E0B',
  high: '#FF7B25',
  critical: '#FF2E1F',
};

export const FLOOD_COLORS = {
  low: '#34FB34',
  moderate: '#F59E0B',
  high: '#FF2E1F',
};

export const RISK_COLORS = {
  flood: '#22D3EE',
  hazard: '#FF2E1F',
  // "Your location" must differ from flood (#22D3EE) and hazard (#FF2E1F) in the
  // Risk areas legend, and from low (#34FB34)/moderate (#F59E0B)/high (#FF2E1F)
  // in the Flood level legend.
  location: '#A855F7',
};

export const MAINTENANCE_STATUS_COLORS = {
  upcoming: '#22D3EE',
  ongoing: '#F59E0B',
  completed: '#34FB34',
};

export const POWER_STATION_COLORS = {
  available: '#34FB34',
  busy: '#FFBB02',
  offline: '#FF2E1F',
};

/**
 * The app-wide map pin, drawn as inline SVG so there is no image asset to load
 * and nothing for a bundler to rewrite (which is what breaks Leaflet's default
 * marker images).
 *
 * Geometry lives in a 32 x 42 box: a circular head (r 11.5, centred at y 14.5)
 * tapering to a tip at `PIN_TIP_Y`. The tip stops short of the box floor so its
 * white outline and the dark underlay are not clipped, and `iconAnchor` is derived
 * from `PIN_TIP_Y` so the tip - not the box centre - sits on the coordinate.
 */
const PIN_BOX = { width: 32, height: 42 };
const PIN_TIP_Y = 38.5;
const PIN_PATH =
  `M16 ${PIN_TIP_Y}C16 ${PIN_TIP_Y} 4.5 26 4.5 14.5` +
  'A11.5 11.5 0 1 1 27.5 14.5' +
  `C27.5 26 16 ${PIN_TIP_Y} 16 ${PIN_TIP_Y}Z`;
const PIN_HEAD = { cx: 16, cy: 14.5, r: 4.5 };
const PIN_WIDTH = 34;
/** Diameter of the round record pin (MapPoints). */
const PIN_DOT_WIDTH = 22;

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => {
    if (character === '&') return '&amp;';
    if (character === '<') return '&lt;';
    if (character === '>') return '&gt;';
    if (character === '"') return '&quot;';
    return '&#39;';
  });

/**
 * The pin as an inline SVG string. Shared by the markers and the legend.
 * `tone` is either a tone name from `PIN_COLORS` or a raw colour (the heatmap
 * legend swatches gradient stops that are not tones).
 */
export function pinSvg(tone = 'primary', glyph = '') {
  const color = PIN_COLORS[tone] || tone || PIN_COLORS.primary;
  const centre = glyph
    ? `<text x="${PIN_HEAD.cx}" y="${PIN_HEAD.cy}" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="700" fill="#ffffff">${escapeHtml(glyph)}</text>`
    : `<circle cx="${PIN_HEAD.cx}" cy="${PIN_HEAD.cy}" r="${PIN_HEAD.r}" fill="#ffffff" />`;

  return (
    `<svg viewBox="0 0 ${PIN_BOX.width} ${PIN_BOX.height}" width="100%" height="100%" aria-hidden="true" focusable="false">` +
    `<path d="${PIN_PATH}" fill="${color}" stroke="${PIN_OUTLINE}" stroke-width="5" stroke-linejoin="round" />` +
    `<path d="${PIN_PATH}" fill="${color}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round" />` +
    centre +
    `</svg>`
  );
}

/**
 * Custom teardrop pin as a divIcon. `size` is the pin WIDTH in pixels (height
 * follows the 32:42 ratio); `className` is appended by Leaflet, so `pg-pin` is
 * what `index.css` hooks onto for the drop shadow.
 */
export function pinIcon(tone = 'primary', glyph = '', options = {}) {
  const { size = PIN_WIDTH, className = '', pulse = false } = options;
  const width = Math.max(14, Math.round(Number(size) || PIN_WIDTH));
  const height = Math.round((width * PIN_BOX.height) / PIN_BOX.width);
  const tipOffset = Math.round((height * PIN_TIP_Y) / PIN_BOX.height);

  return L.divIcon({
    className: clsx('pg-pin', pulse ? 'pulse-marker' : '', className),
    html: pinSvg(tone, glyph),
    iconSize: [width, height],
    iconAnchor: [width / 2, tipOffset],
    popupAnchor: [0, -tipOffset + 6],
  });
}

/**
 * The record pin used by every map: a white-ringed circle with a dark outer edge,
 * so it reads on both pale tiles and dark overlays. An optional glyph letter
 * renders centred in white for the staff maps.
 * `size` is the circle DIAMETER in pixels.
 */
export function circlePinSvg(tone = 'primary', glyph = '', size = PIN_DOT_WIDTH, pulse = true, soft = false) {
  const color = PIN_COLORS[tone] || tone || PIN_COLORS.primary;
  // Heatmap marker: layered translucent colour instead of a solid, ringed pin.
  if (soft) {
    return (
      `<svg viewBox="0 0 18 18" width="100%" height="100%" aria-hidden="true" focusable="false">` +
      `<circle cx="9" cy="9" r="8.5" fill="${color}" fill-opacity="0.14" />` +
      `<circle cx="9" cy="9" r="5.5" fill="${color}" fill-opacity="0.3" />` +
      `<circle cx="9" cy="9" r="2.5" fill="${color}" fill-opacity="0.45" />` +
      `</svg>`
    );
  }
  const centre = glyph
    ? `<text x="9" y="9" text-anchor="middle" dominant-baseline="central" font-size="${Math.max(9, Math.round(size * 0.42))}" font-weight="700" fill="#ffffff">${escapeHtml(glyph)}</text>`
    : '';
  const pulseRing = pulse
    ? `<circle class="pulse-ring" cx="9" cy="9" r="7.5" fill="none" stroke="${color}" stroke-width="2" />`
    : '';
  return (
    `<svg viewBox="0 0 18 18" width="100%" height="100%" aria-hidden="true" focusable="false">` +
    pulseRing +
    `<circle cx="9" cy="9" r="7.4" fill="none" stroke="${PIN_OUTLINE}" stroke-width="2.4" />` +
    `<circle cx="9" cy="9" r="6.8" fill="${color}" fill-opacity="0.88" stroke="#ffffff" stroke-width="2" />` +
    centre +
    `</svg>`
  );
}

export function circlePinIcon(tone = 'primary', glyph = '', options = {}) {
  const { size = PIN_DOT_WIDTH, className = '', pulse = true, soft = false } = options;
  const width = Math.max(12, Math.round(Number(size) || PIN_DOT_WIDTH));

  return L.divIcon({
    className: clsx('pg-pin', pulse && !soft ? 'pulse-marker' : '', className),
    html: circlePinSvg(tone, glyph, width, pulse, soft),
    iconSize: [width, width],
    iconAnchor: [width / 2, width / 2],
    popupAnchor: [0, -width / 2 + 4],
  });
}

/**
 * Keeps the viewport on `center` as it changes.
 *
 * `MapContainer` only reads its centre on mount, so a map rendered before its
 * coordinates arrive (nearly every page loads the saved location asynchronously)
 * would stay stuck on the default Dagupan view. Only acts when a real centre is
 * supplied, so pages with no location keep the default view, and it never fires
 * on a plain re-render - so it does not fight the user after they pan.
 */
function SyncView({ center, zoom }) {
  const map = useMap();
  const lat = Number(center?.lat);
  const lng = Number(center?.lng ?? center?.lon);
  const targetZoom = Number(zoom) || null;
  const hasCenter = Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    if (!hasCenter) return;
    const current = map.getCenter();
    if (Math.abs(current.lat - lat) < 1e-6 && Math.abs(current.lng - lng) < 1e-6) return;
    map.setView([lat, lng], targetZoom || map.getZoom(), { animate: true });
  }, [hasCenter, lat, lng, targetZoom, map]);

  return null;
}

/** Leaflet map with the app's tile layer and default Dagupan centre. */
export default function AppMap({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_CENTER.zoom,
  className = 'h-96 w-full',
  children,
  scrollWheelZoom = false,
  whenReady,
  ...rest
}) {
  const lat = Number(center?.lat);
  const lng = Number(center?.lng ?? center?.lon);
  const hasCenter = Number.isFinite(lat) && Number.isFinite(lng);

  const initialView = useMemo(
    () => ({
      center: hasCenter ? [lat, lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      zoom: Number(zoom) || DEFAULT_CENTER.zoom,
    }),
    // Mount-only: Leaflet keeps its own view state afterwards, and <SyncView>
    // moves it from there as `center` resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <MapContainer
      center={initialView.center}
      zoom={initialView.zoom}
      scrollWheelZoom={scrollWheelZoom}
      // Dark map theme; pg-dark-map skins Leaflet controls and popups.
      className={clsx('pg-dark-map', className)}
      {...rest}
    >
      <BaseLayer />
      <SyncView center={center} zoom={zoom} />
      {whenReady}
      {children}
    </MapContainer>
  );
}

/** Imperatively move the map when the coordinates change (no remount). */
export function MapView({ center, zoom, animate = true }) {
  const map = useMap();
  const lat = Number(center?.lat);
  const lng = Number(center?.lng);
  const nextZoom = Number(zoom) || null;

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (animate) {
      map.flyTo([lat, lng], nextZoom || map.getZoom(), { duration: 0.6 });
    } else {
      map.setView([lat, lng], nextZoom || map.getZoom(), { animate: false });
    }
  }, [lat, lng, nextZoom, animate, map]);

  return null;
}

/** Single record marker with a popup. */
export function MapPin({ position, tone = 'primary', glyph = '', size, children }) {
  if (!position) return null;
  const lat = Number(position.lat);
  const lng = Number(position.lng ?? position.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return (
    <Marker position={[lat, lng]} icon={circlePinIcon(tone, glyph, { size })}>
      {children ? <Popup>{children}</Popup> : null}
    </Marker>
  );
}

/** Many records drawn as circle pins (one marker each); `soft` gives translucent heat blobs. */
export function MapPoints({ items = [], toneFor, size = PIN_DOT_WIDTH, glyphFor, children, soft = false }) {
  return (
    <>
      {items.map((item, index) => {
        const lat = Number(item.lat);
        const lng = Number(item.lng ?? item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const tone = toneFor ? toneFor(item) : item.tone || 'primary';
        return (
          <Marker
            key={item.id ?? `${lat}-${lng}-${index}`}
            position={[lat, lng]}
            icon={circlePinIcon(tone, glyphFor ? glyphFor(item) : '', { size, soft })}
          >
            {children ? <Popup>{children(item)}</Popup> : null}
          </Marker>
        );
      })}
    </>
  );
}

/**
 * Invisible clickable areas over a set of points, each opening a popup.
 *
 * Used for the heatmap, whose blobs are drawn by leaflet.heat and therefore carry
 * no click handling of their own. These are sized DOM `divIcon`s rather than
 * transparent `CircleMarker`s on purpose: a DOM element reliably receives clicks
 * across its whole box, whereas a zero-opacity SVG fill is hit-tested
 * inconsistently between browsers.
 */
export function MapHitAreas({ items = [], radius = 36, radiusFor, children }) {
  return (
    <>
      {items.map((item, index) => {
        const lat = Number(item.lat);
        const lng = Number(item.lng ?? item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const size = Math.max(
          20,
          Math.round(Number(radiusFor ? radiusFor(item) : item.hitRadius ?? radius) || radius)
        );

        return (
          <Marker
            key={item.id ?? `${lat}-${lng}-${index}`}
            position={[lat, lng]}
            icon={L.divIcon({
              className: 'pg-hit-area',
              html: '',
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
              popupAnchor: [0, -size / 2],
            })}
          >
            {children ? <Popup>{children(item)}</Popup> : null}
          </Marker>
        );
      })}
    </>
  );
}

/**
 * Fits the viewport to the plotted points without remounting the map.
 *
 * Re-fits only when the SET of coordinates changes (not on every render), so
 * panning/zooming by hand is not fought by a re-render of the parent.
 *
 * `radiusFor(item)` is optional. When given, each point is grown by its own radius
 * before fitting, so a map of coverage areas shows the WHOLE circle rather than just
 * its centre - otherwise a 2 km circle on a barangay near the edge of the fitted
 * bounds spills off-screen and the map under-reports its own coverage. It is held in
 * a ref rather than a dependency because callers pass an inline arrow, which would
 * otherwise re-run this effect on every render and fight the user's panning.
 */
export function FitPoints({ items = [], padding = 56, maxZoom = 16, animate = true, radiusFor }) {
  const map = useMap();

  // `{ lat, lng, item }` rather than bare pairs, so `radiusFor` receives the original
  // item and not a coordinate that has lost its association with its record.
  const points = useMemo(
    () =>
      items
        .map((item) => ({ lat: Number(item.lat), lng: Number(item.lng ?? item.lon), item }))
        .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng)),
    [items]
  );

  const radiusForRef = useRef(radiusFor);
  radiusForRef.current = radiusFor;

  const signature = points.map(({ lat, lng }) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join('|');

  useEffect(() => {
    if (!points.length) return;

    const resolveRadius = radiusForRef.current;
    const maxRadius = resolveRadius
      ? points.reduce((widest, { item }) => {
          const radius = Number(resolveRadius(item));
          return Number.isFinite(radius) && radius > widest ? radius : widest;
        }, 0)
      : 0;

    if (points.length === 1 && !maxRadius) {
      map.setView([points[0].lat, points[0].lng], Math.min(maxZoom, 15), { animate });
      return;
    }

    const bounds = L.latLngBounds([]);
    points.forEach(({ lat, lng }) => {
      // `toBounds` grows a square `2 * r` across, i.e. `r` in every direction.
      bounds.extend(maxRadius ? L.latLng(lat, lng).toBounds(maxRadius * 2) : L.latLng(lat, lng));
    });

    map.fitBounds(bounds, { padding: [padding, padding], maxZoom, animate });
    // `signature` stands in for `points` so a re-render with an equal set of
    // coordinates does not yank the viewport back; `radiusFor` is read through a ref
    // for the same reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map, padding, maxZoom, animate]);

  return null;
}

/** "Near me" search radius. */
export function RadiusCircle({ center, radius, color = '#22D3EE' }) {
  const lat = Number(center?.lat);
  const lng = Number(center?.lng ?? center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number(radius)) return null;

  return (
    <Circle
      center={[lat, lng]}
      radius={Number(radius)}
      pathOptions={{ color, weight: 1.5, fillColor: color, fillOpacity: 0.08 }}
    />
  );
}

/**
 * A circle with an optional popup - used for cluster footprints and risk radii.
 *
 * Wrapped rather than used directly because react-leaflet paths do NOT treat children
 * as popup content: a path ports its children into its own DOM node. The popup has to
 * be an explicit `<Popup>` child for `bindPopup` to be called, and that is easy to get
 * wrong, so callers get one component with a `children`-means-popup contract.
 */
export function MapCircle({ center, radius, color = '#F59E0B', fillColor, fillOpacity = 0.18, weight = 1.5, children }) {
  const lat = Number(center?.lat);
  const lng = Number(center?.lng ?? center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number(radius)) return null;

  return (
    <Circle
      center={[lat, lng]}
      radius={Number(radius)}
      pathOptions={{ color, weight, fillColor: fillColor || color, fillOpacity }}
    >
      {children ? <Popup>{children}</Popup> : null}
    </Circle>
  );
}

/**
 * Heat gradient, shared by the layer and the Heatmap legend so the two cannot
 * drift apart. Fully saturated stops: leaflet.heat multiplies the gradient colour
 * by the pixel alpha, so a pale stop renders as a pale wash.
 */
export const HEAT_GRADIENT = {
  0.2: '#f18f01',
  0.4: '#FF8A00',
  0.6: '#FF5510',
  0.8: '#FF2E1F',
  1: '#C81E10',
};

/** Legend rows derived from `HEAT_GRADIENT`. */
export const HEAT_LEGEND = [
  { label: 'Low intensity', color: HEAT_GRADIENT[0.2] },
  { label: 'Moderate', color: HEAT_GRADIENT[0.4] },
  { label: 'High', color: HEAT_GRADIENT[0.6] },
  { label: 'Very high', color: HEAT_GRADIENT[0.8] },
];

/**
 * Leaflet.heat layer. `points` = [{ lat, lng, intensity }].
 * Read-only: rendered straight from `heatmap/get.php`.
 *
 * `minOpacity` is the important knob here, not just a floor for empty pixels:
 * leaflet.heat draws each point at `globalAlpha = max(intensity / max, minOpacity)`
 * and then recolours the canvas by alpha, so a low value washes the whole layer
 * out. 0.6 keeps colours close to solid while intensity still separates the stops.
 *
 * `leaflet.heat` is a UMD plugin that mutates the global `L` (bridged to the npm
 * leaflet instance at module scope above). It is loaded as a deferred global script
 * (`/leaflet-heat.js` in index.html) so `L.heatLayer` exists before this layer mounts.
 */
export function HeatLayer({
  points = [],
  radius = 30,
  blur = 18,
  minOpacity = 0.6,
  maxZoom = 17,
  gradient = HEAT_GRADIENT,
}) {
  const map = useMap();
  const validPoints = useMemo(
    () =>
      points
        .map((point) => [Number(point.lat), Number(point.lng), Number(point.intensity) || 0.5])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)),
    [points]
  );

  useEffect(() => {
    if (!validPoints.length) return undefined;
    if (typeof L.heatLayer !== 'function') {
      console.error('Heat layer: leaflet.heat is not loaded - load leaflet-heat.js globally before the app');
      return undefined;
    }

    const layer = L.heatLayer(validPoints, { radius, blur, minOpacity, maxZoom, gradient });
    layer.addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [validPoints, map, radius, blur, minOpacity, maxZoom, gradient]);

  return null;
}

/**
 * Small legend rendered over the map (bottom-left by default), styled for the
 * dark map theme.
 */
export function MapLegend({ items = [], title, className, position = 'bottom' }) {
  if (!items.length) return null;

  return (
    <div
      className={clsx(
        'map-legend-panel z-[1000]',
        position === 'top' ? 'top-3 left-3' : 'bottom-3 left-3',
        className
      )}
    >
      {title ? (
        <p className="mb-2 text-[8px] font-extrabold uppercase tracking-[0.2em] text-white/40">{title}</p>
      ) : null}
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-[9px] font-medium text-white/80">
            <PinSwatch
              className="h-3.5 w-3.5 shrink-0"
              color={item.color || PIN_COLORS[item.tone] || PIN_COLORS.primary}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Miniature of the record pin, so the legend reads as the same white-ringed circle. */
function PinSwatch({ color, className }) {
  return (
    <span
      className={clsx('block shrink-0', className)}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: circlePinSvg(color, '', 18, true) }}
    />
  );
}

export { PIN_COLORS, PIN_WIDTH };
