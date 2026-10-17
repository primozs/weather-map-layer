import { describe, expect, it } from 'vitest';

import { RADAR_RAIN_MIN_DBZ } from './utils/custom-domain-scales';
import { normalizeArsoRadarReflectivity } from './om-protocol-state';

describe('normalizeArsoRadarReflectivity', () => {
	it('masks nodata and sub-rain reflectivity in place', () => {
		const values = new Float32Array([-34.5, -40, 5, 9.9, 10, 25]);
		normalizeArsoRadarReflectivity(values);
		expect(Number.isNaN(values[0]!)).toBe(true);
		expect(Number.isNaN(values[1]!)).toBe(true);
		expect(Number.isNaN(values[2]!)).toBe(true);
		expect(Number.isNaN(values[3]!)).toBe(true);
		expect(values[4]).toBe(RADAR_RAIN_MIN_DBZ);
		expect(values[5]).toBe(25);
	});
});
