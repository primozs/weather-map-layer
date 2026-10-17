import { describe, expect, it } from 'vitest';

import type { Data, DataIdentityOptions, Domain } from './types';
import { RADAR_RAIN_MIN_DBZ } from './utils/custom-domain-scales';
import { normalizeArsoRadarReflectivity, normalizeReadValues } from './om-protocol-state';

const stubDomain = (value: string): Domain =>
	({
		value,
		label: value,
		grid: {
			type: 'regular',
			nx: 1,
			ny: 1,
			latMin: 0,
			lonMin: 0,
			dx: 1,
			dy: 1,
			zoom: 1
		},
		time_interval: 'hourly',
		model_interval: 'hourly'
	}) as Domain;

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

describe('normalizeReadValues ARSO gate', () => {
	it('masks arso_* radar_reflectivity', () => {
		const values = new Float32Array([5, 25]);
		const data: Data = { values, directions: undefined };
		const opts: DataIdentityOptions = {
			domain: stubDomain('arso_rain_radar_5min'),
			variable: 'radar_reflectivity',
			bounds: undefined
		};
		normalizeReadValues(data, opts);
		expect(Number.isNaN(values[0]!)).toBe(true);
		expect(values[1]).toBe(25);
	});

	it('leaves world_radar radar_reflectivity untouched', () => {
		const values = new Float32Array([5, 25]);
		const data: Data = { values, directions: undefined };
		const opts: DataIdentityOptions = {
			domain: stubDomain('world_radar_5min'),
			variable: 'radar_reflectivity',
			bounds: undefined
		};
		normalizeReadValues(data, opts);
		expect(values[0]).toBe(5);
		expect(values[1]).toBe(25);
	});
});
