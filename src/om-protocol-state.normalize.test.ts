import { describe, expect, it } from 'vitest';

import { RADAR_RAIN_MIN_DBZ } from './utils/custom-domain-scales';

describe('radar reflectivity read normalization', () => {
	const ARSO_RADAR_NODATA_DBZ = -34.5;

	function normalizeRadarValues(values: number[]): number[] {
		return values.map((v) =>
			v <= ARSO_RADAR_NODATA_DBZ || v < RADAR_RAIN_MIN_DBZ ? Number.NaN : v
		);
	}

	it('masks nodata and sub-rain reflectivity', () => {
		const out = normalizeRadarValues([-34.5, -40, 5, 9.9, 10, 25]);
		expect(Number.isNaN(out[0])).toBe(true);
		expect(Number.isNaN(out[1])).toBe(true);
		expect(Number.isNaN(out[2])).toBe(true);
		expect(Number.isNaN(out[3])).toBe(true);
		expect(out[4]).toBe(10);
		expect(out[5]).toBe(25);
	});
});
