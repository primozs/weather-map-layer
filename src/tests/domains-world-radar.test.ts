import { describe, expect, it } from 'vitest';
import { domainOptions } from '../domains';

describe('world_radar_5min domain', () => {
	it('is north-origin (row 0 = north, dy < 0)', () => {
		const domain = domainOptions.find((d) => d.value === 'world_radar_5min');
		expect(domain).toBeDefined();
		const grid = domain!.grid;
		expect(grid.type).toBe('regular');
		if (grid.type !== 'regular') return;
		expect(grid.nx).toBe(60600);
		expect(grid.ny).toBe(12400);
		expect(grid.dx).toBe(0.005);
		expect(grid.dy).toBeLessThan(0);
		expect(grid.dy).toBeCloseTo(-0.005, 10);
		// Geographic south edge of mosaic is ~10°; latMin is the north origin.
		expect(grid.latMin).toBeCloseTo(10 + (12400 - 1) * 0.005, 5);
		expect(grid.lonMin).toBe(-176);
	});
});
