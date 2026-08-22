import { describe, expect, it } from 'vitest';

import { getColor, getColorScale } from '../utils/styling';
import { COLOR_SCALES_WITH_ALIASES } from '../utils/styling';
import { RADAR_RAIN_MIN_DBZ } from './custom-domain-scales';

type RGBA = [number, number, number, number];

describe('custom domain color scales', () => {
	it('radar reflectivity uses rain-only breakpoints from 10 dBZ', () => {
		const scale = getColorScale('radar_reflectivity', false, COLOR_SCALES_WITH_ALIASES);
		expect(scale.type).toBe('breakpoint');
		if (scale.type !== 'breakpoint') return;
		expect(scale.breakpoints[0]).toBe(RADAR_RAIN_MIN_DBZ);
		const colors = scale.colors as RGBA[];
		expect(colors[0]).toEqual([0, 0, 0, 0]);
	});

	it('merged defaults expose soaring thermal_velocity scale', () => {
		const scale = getColorScale('thermal_velocity', false, COLOR_SCALES_WITH_ALIASES);
		expect(scale.unit).toBe('m/s');
		expect(scale.type).toBe('breakpoint');
	});

	it('paraglidable flyability and crossability scales exist', () => {
		for (const variable of ['flyability', 'crossability'] as const) {
			const scale = getColorScale(variable, false, COLOR_SCALES_WITH_ALIASES);
			expect(scale.type).toBe('breakpoint');
			if (scale.type === 'breakpoint') {
				expect(scale.breakpoints).toEqual([0, 0.5, 1]);
			}
		}
	});
});
