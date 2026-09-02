import { pad } from '../utils';
import { parseMetaJson, parseUrlComponents } from '../utils/parse-url';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('URL Parsing', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});
	describe('parseMetaJson', () => {
		it('resolves latest.json to current model run URL', async () => {
			const url =
				'https://map-tiles.open-meteo.com/data_spatial/dwd_icon/latest.json?time_step=current_time_1H&variable=temperature_2m';
			const parsedUrl = await parseMetaJson(url);
			const now = new Date();

			expect(parsedUrl).not.toContain('latest');
			expect(parsedUrl).toContain(
				`/${now.getUTCFullYear()}/${pad(now.getUTCMonth() + 1)}/${pad(now.getUTCDate())}/`
			);
			expect(parsedUrl).not.toContain('current_time_1H');
		});

		it('resolves in-progress.json to current model run URL', async () => {
			const url =
				'https://map-tiles.open-meteo.com/data_spatial/dwd_icon/in-progress.json?time_step=current_time_1H&variable=temperature_2m';
			const parsedUrl = await parseMetaJson(url);

			expect(parsedUrl).not.toContain('in-progress');
		});

		it('preserves UTC minutes in resolved .om filename for 5-minute frames', async () => {
			const catalog = {
				reference_time: '2026-09-02T12:00:00Z',
				valid_times: ['2026-09-02T12:00Z', '2026-09-02T12:05Z', '2026-09-02T14:45Z'],
				variables: ['radar_reflectivity']
			};
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					json: async () => catalog
				})
			);

			const parsedUrl = await parseMetaJson(
				'https://meteo.test/data_spatial/arso_min/latest.json?time_step=valid_times_2&variable=radar_reflectivity'
			);

			expect(parsedUrl).toContain('/2026/09/02/1200Z/2026-09-02T1445.om');
			expect(parsedUrl).not.toContain('T1400.om');
			expect(parsedUrl).not.toContain('NaN');
		});

		it('throws when valid_times index is out of range', async () => {
			const catalog = {
				reference_time: '2026-09-02T12:00:00Z',
				valid_times: ['2026-09-02T12:00Z'],
				variables: ['radar_reflectivity']
			};
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					json: async () => catalog
				})
			);

			await expect(
				parseMetaJson(
					'https://meteo.test/data_spatial/arso_oob/latest.json?time_step=valid_times_99&variable=radar_reflectivity'
				)
			).rejects.toThrow(/valid_times index/);
		});
	});

	describe('parseUrlComponents', () => {
		it('parses URL with query params and tile coordinates', async () => {
			const url =
				'om://https://example.com/data_spatial/domain1/file.om?variable=temp&dark=true/5/10/15';
			const components = parseUrlComponents(url);

			expect(components.baseUrl).toBe('https://example.com/data_spatial/domain1/file.om');
			expect(components.params.get('variable')).toBe('temp');
			expect(components.params.get('dark')).toBe('true');
			expect(components.tileIndex).toEqual({ z: 5, x: 10, y: 15 });
		});

		it('parses URL without tile coordinates (tilejson request)', async () => {
			const url = 'om://https://example.com/data_spatial/domain1/file.om?variable=temp';
			const components = parseUrlComponents(url);

			expect(components.baseUrl).toBe('https://example.com/data_spatial/domain1/file.om');
			expect(components.tileIndex).toBeNull();
		});

		it('excludes rendering-only params from stateKey', async () => {
			const url1 =
				'om://https://example.com/data_spatial/domain1/file.om?variable=temp&tile_size=512';
			const url2 =
				'om://https://example.com/data_spatial/domain1/file.om?variable=temp&tile_size=256';

			const components1 = parseUrlComponents(url1);
			const components2 = parseUrlComponents(url2);

			// Same stateKey despite different tile_size
			expect(components1.fileAndVariableKey).toBe(components2.fileAndVariableKey);
		});

		it('includes data-affecting params in stateKey', async () => {
			const url1 = 'om://https://example.com/data_spatial/domain1/file.om?variable=temp';
			const url2 = 'om://https://example.com/data_spatial/domain1/file.om?variable=humidity';

			const components1 = parseUrlComponents(url1);
			const components2 = parseUrlComponents(url2);

			expect(components1.fileAndVariableKey).not.toBe(components2.fileAndVariableKey);
		});

		it('rejects invalid OM protocol URL', async () => {
			expect(() => parseUrlComponents('https://example.com/file.om')).toThrow(
				'Invalid OM protocol URL'
			);
		});
	});
});
