import type { BreakpointColorScale, ColorScales } from '../types';

type RGBA = [number, number, number, number];

/** Values below this are treated as no rain (transparent on map). */
export const RADAR_RAIN_MIN_DBZ = 10;

/** Top reflectivity bin shown (hail whites above this are omitted). */
export const RADAR_RAIN_MAX_DBZ = 57;

const FULL_STENAR_BREAKPOINTS = [
	-32, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17,
	18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 64, 65, 66,
	67, 68, 69, 70, 71, 72, 73, 74
] as const;

const FULL_STENAR_COLORS: RGBA[] = [
	[0, 0, 0, 0],
	[99, 97, 89, 0.078],
	[102, 99, 90, 0.098],
	[105, 102, 92, 0.118],
	[108, 104, 93, 0.141],
	[111, 107, 95, 0.161],
	[114, 110, 97, 0.18],
	[117, 112, 98, 0.204],
	[120, 115, 100, 0.224],
	[124, 117, 101, 0.243],
	[127, 120, 103, 0.267],
	[130, 123, 105, 0.286],
	[133, 125, 106, 0.306],
	[136, 128, 108, 0.329],
	[139, 130, 109, 0.349],
	[142, 133, 111, 0.369],
	[146, 136, 113, 0.392],
	[158, 147, 117, 0.431],
	[170, 158, 121, 0.471],
	[182, 169, 126, 0.51],
	[194, 180, 130, 0.549],
	[206, 192, 135, 0.588],
	[136, 221, 238, 1],
	[108, 209, 235, 1],
	[81, 197, 232, 1],
	[54, 186, 229, 1],
	[27, 174, 226, 1],
	[0, 163, 224, 1],
	[0, 154, 213, 1],
	[0, 145, 202, 1],
	[0, 136, 191, 1],
	[0, 127, 180, 1],
	[0, 119, 170, 1],
	[0, 112, 163, 1],
	[4, 216, 131, 1],
	[66, 235, 66, 1],
	[108, 249, 0, 1],
	[184, 250, 0, 1],
	[249, 250, 1, 1],
	[254, 198, 0, 1],
	[254, 132, 0, 1],
	[255, 62, 1, 1],
	[211, 0, 0, 1],
	[181, 3, 3, 1],
	[203, 0, 204, 1],
	[203, 0, 204, 1],
	[255, 255, 255, 1],
	[255, 255, 255, 1],
	[255, 255, 255, 1],
	[255, 255, 255, 1],
	[255, 255, 255, 1],
	[255, 255, 255, 1],
	[255, 255, 255, 1],
	[255, 255, 255, 1],
	[255, 255, 255, 1],
	[255, 255, 255, 1]
];

const RAIN_BREAKPOINTS = [10, 15, 20, 25, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57] as const;

const TRANSPARENT: RGBA = [0, 0, 0, 0];

function stenarColorAtDbz(dbz: number): RGBA {
	const idx = FULL_STENAR_BREAKPOINTS.indexOf(dbz as (typeof FULL_STENAR_BREAKPOINTS)[number]);
	if (idx < 0) {
		throw new Error(`Missing Stenar palette entry for ${dbz} dBZ`);
	}
	return FULL_STENAR_COLORS[idx];
}

function buildRainReflectivityColorScale(): BreakpointColorScale {
	const colors = RAIN_BREAKPOINTS.map((dbz) =>
		dbz === RADAR_RAIN_MIN_DBZ ? TRANSPARENT : stenarColorAtDbz(dbz)
	);
	return {
		type: 'breakpoint',
		unit: 'dBZ',
		breakpoints: [...RAIN_BREAKPOINTS],
		colors
	};
}

function breakpointScale(
	unit: string,
	breakpoints: number[],
	colors: RGBA[]
): BreakpointColorScale {
	return { type: 'breakpoint', unit, breakpoints, colors };
}

/** Custom-domain palettes (ARSO, soaring_alps, paraglidable_flyability). */
export const CUSTOM_DOMAIN_COLOR_SCALES: ColorScales = {
	radar_reflectivity: buildRainReflectivityColorScale(),
	thermal_velocity: breakpointScale(
		'm/s',
		[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4],
		[
			[180, 190, 200, 0.35],
			[160, 200, 180, 0.55],
			[120, 200, 120, 0.75],
			[200, 220, 80, 0.9],
			[240, 200, 40, 1],
			[255, 160, 0, 1],
			[255, 100, 0, 1],
			[220, 40, 0, 1],
			[160, 0, 0, 1]
		]
	),
	soaring_layer_depth: breakpointScale(
		'm',
		[0, 500, 1000, 1500, 2000, 2500, 3000],
		[
			[220, 220, 220, 0.4],
			[180, 210, 240, 0.6],
			[120, 180, 230, 0.75],
			[80, 140, 210, 0.9],
			[60, 100, 180, 1],
			[40, 70, 150, 1],
			[20, 40, 100, 1]
		]
	),
	boundary_layer_height: breakpointScale(
		'm',
		[0, 500, 1000, 1500, 2000, 2500, 3000],
		[
			[220, 220, 220, 0.4],
			[180, 210, 240, 0.6],
			[120, 180, 230, 0.75],
			[80, 140, 210, 0.9],
			[60, 100, 180, 1],
			[40, 70, 150, 1],
			[20, 40, 100, 1]
		]
	),
	xc_flying_potential: breakpointScale(
		'',
		[0, 20, 40, 60, 80, 100],
		[
			[160, 160, 160, 0.45],
			[180, 200, 120, 0.65],
			[120, 200, 80, 0.8],
			[60, 180, 60, 0.9],
			[30, 140, 200, 1],
			[20, 60, 180, 1]
		]
	),
	sensible_heat_flux: breakpointScale(
		'W/m²',
		[0, 50, 100, 150, 200, 300, 400],
		[
			[200, 200, 200, 0.35],
			[220, 200, 160, 0.55],
			[240, 180, 100, 0.7],
			[255, 140, 60, 0.85],
			[255, 80, 20, 1],
			[220, 20, 0, 1],
			[140, 0, 0, 1]
		]
	),
	flyability: breakpointScale(
		'',
		[0, 0.5, 1],
		[
			[160, 0, 0, 1],
			[160, 112, 0, 1],
			[0, 160, 0, 1]
		]
	),
	crossability: breakpointScale(
		'',
		[0, 0.5, 1],
		[
			[160, 0, 0, 1],
			[160, 112, 0, 1],
			[0, 160, 0, 1]
		]
	)
};
