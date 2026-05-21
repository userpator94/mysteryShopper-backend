export const MAX_LOCATION_POINTS = Math.min(
  20,
  Math.max(1, parseInt(process.env.MAX_LOCATION_POINTS || '10', 10) || 10)
);

export interface LocationPoint {
  lng: number;
  lat: number;
  label?: string;
}

const LABEL_MAX = 200;

function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function parseOnePoint(raw: unknown, index: number): { ok: true; point: LocationPoint } | { ok: false; message: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, message: `location_points[${index}]: неверный формат` };
  }
  const o = raw as Record<string, unknown>;
  const lng = typeof o.lng === 'number' ? o.lng : Number(o.lng);
  const lat = typeof o.lat === 'number' ? o.lat : Number(o.lat);
  if (!isFiniteCoord(lng) || !isFiniteCoord(lat)) {
    return { ok: false, message: `location_points[${index}]: lng и lat обязательны` };
  }
  if (lng < -180 || lng > 180) {
    return { ok: false, message: `location_points[${index}]: lng вне диапазона` };
  }
  if (lat < -90 || lat > 90) {
    return { ok: false, message: `location_points[${index}]: lat вне диапазона` };
  }
  let label: string | undefined;
  if (o.label !== undefined && o.label !== null) {
    if (typeof o.label !== 'string') {
      return { ok: false, message: `location_points[${index}]: label должен быть строкой` };
    }
    label = o.label.trim().slice(0, LABEL_MAX) || undefined;
  }
  return { ok: true, point: { lng, lat, ...(label ? { label } : {}) } };
}

/** null / [] — без карты; иначе 1…MAX_LOCATION_POINTS точек */
export function parseLocationPoints(
  raw: unknown
): { ok: true; points: LocationPoint[] | null } | { ok: false; message: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, points: null };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, message: 'location_points должен быть массивом или null' };
  }
  if (raw.length === 0) {
    return { ok: true, points: null };
  }
  if (raw.length > MAX_LOCATION_POINTS) {
    return { ok: false, message: `Не более ${MAX_LOCATION_POINTS} меток на карте` };
  }
  const points: LocationPoint[] = [];
  for (let i = 0; i < raw.length; i++) {
    const parsed = parseOnePoint(raw[i], i);
    if (!parsed.ok) return parsed;
    points.push(parsed.point);
  }
  return { ok: true, points };
}
