import { parseLocationPoints, MAX_LOCATION_POINTS } from './locationPointsValidator';

describe('parseLocationPoints', () => {
  it('accepts null and empty array as no map', () => {
    expect(parseLocationPoints(null)).toEqual({ ok: true, points: null });
    expect(parseLocationPoints([])).toEqual({ ok: true, points: null });
  });

  it('accepts valid points', () => {
    const r = parseLocationPoints([{ lng: 37.6, lat: 55.7, label: 'A' }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.points).toHaveLength(1);
      expect(r.points![0].label).toBe('A');
    }
  });

  it('rejects invalid coordinates', () => {
    expect(parseLocationPoints([{ lng: 200, lat: 55 }]).ok).toBe(false);
  });

  it('rejects too many points', () => {
    const many = Array.from({ length: MAX_LOCATION_POINTS + 1 }, (_, i) => ({
      lng: 37 + i * 0.001,
      lat: 55
    }));
    expect(parseLocationPoints(many).ok).toBe(false);
  });
});
