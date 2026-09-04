import { parseMetaJson, parseUrlComponents } from '../utils/parse-url';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('URL Parsing', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});
	describe('parseMetaJson', () => {
		it('resolves latest.json current_time offset to model-run .om URL', async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-09-02T12:00:00Z'));
			const catalog = {
				reference_time: '2026-09-02T00:00:00Z',
				valid_times: ['2026-09-02T00:00Z', '2026-09-02T12:00Z'],
				variables: ['temperature_2m']
			};
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: true,
					json: async () => catalog
				})
			);

			const parsedUrl = await parseMetaJson(
				'https://meteo.test/data_spatial/dwd_icon/latest.json?time_step=current_time_1H&variable=temperature_2m'
			);

			expect(parsedUrl).not.toContain('latest');
			expect(parsedUrl).not.toContain('current_time_1H');
			expect(parsedUrl).toContain('/2026/09/02/0000Z/2026-09-02T1300.om');
			vi.useRealTimers();
		});

		it('resolves in-progress.json to model-run .om URL', async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-09-02T12:00:00Z'));
			const catalog = {
				reference_time: '2026-09-02T06:00:00Z',
				valid_times: ['2026-09-02T06:00Z', '2026-09-02T12:00Z'],
				variables: ['temperature_2m']
			};
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: true,
					json: async () => catalog
				})
			);

			const parsedUrl = await parseMetaJson(
				'https://meteo.test/data_spatial/dwd_icon/in-progress.json?time_step=current_time&variable=temperature_2m'
			);

			expect(parsedUrl).not.toContain('in-progress');
			expect(parsedUrl).toContain('/2026/09/02/0600Z/2026-09-02T1200.om');
			vi.useRealTimers();
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
					ok: true,
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

		it('rejects valid_times index that stays out of range after refetch', async () => {
			const catalog = {
				reference_time: '2026-09-02T12:00:00Z',
				valid_times: ['2026-09-02T12:00Z'],
				variables: ['radar_reflectivity']
			};
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: true,
					json: async () => catalog
				})
			);

			await expect(
				parseMetaJson(
					'https://meteo.test/data_spatial/arso_clamp/latest.json?time_step=valid_times_99&variable=radar_reflectivity'
				)
			).rejects.toThrow(/valid_times index 99 out of range \(len=1\)/);
		});

		it('refetches latest.json without HTTP cache when valid_times grew', async () => {
			const short = {
				reference_time: '2026-09-02T12:00:00Z',
				valid_times: ['2026-09-02T12:00Z', '2026-09-02T12:05Z'],
				variables: ['radar_reflectivity']
			};
			const grown = {
				...short,
				valid_times: [...short.valid_times, '2026-09-02T12:10Z']
			};
			const fetchMock = vi
				.fn()
				.mockResolvedValueOnce({ ok: true, json: async () => short })
				.mockResolvedValueOnce({ ok: true, json: async () => grown });
			vi.stubGlobal('fetch', fetchMock);

			const parsedUrl = await parseMetaJson(
				'https://meteo.test/data_spatial/arso_grow/latest.json?time_step=valid_times_2&variable=radar_reflectivity'
			);

			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(fetchMock).toHaveBeenNthCalledWith(
				2,
				'https://meteo.test/data_spatial/arso_grow/latest.json',
				{ cache: 'no-store' }
			);
			expect(parsedUrl).toContain('/2026/09/02/1200Z/2026-09-02T1210.om');
		});

		it('rejects non-OK meta.json HTTP responses', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: false,
					status: 404,
					json: async () => ({ error: 'not found' })
				})
			);

			await expect(
				parseMetaJson(
					'https://meteo.test/data_spatial/arso_404/latest.json?time_step=valid_times_0&variable=radar_reflectivity'
				)
			).rejects.toThrow(/Failed to fetch meta\.json \(404\)/);
		});

		it('rejects meta.json bodies that are not catalogs', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: true,
					json: async () => '<!DOCTYPE html>not a catalog'
				})
			);

			await expect(
				parseMetaJson(
					'https://meteo.test/data_spatial/arso_html/latest.json?time_step=valid_times_0&variable=radar_reflectivity'
				)
			).rejects.toThrow(/Invalid meta\.json/);
		});

		it('rejects meta.json with empty valid_times', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: true,
					json: async () => ({
						reference_time: '2026-09-02T12:00:00Z',
						valid_times: [],
						variables: ['radar_reflectivity']
					})
				})
			);

			await expect(
				parseMetaJson(
					'https://meteo.test/data_spatial/arso_empty/latest.json?time_step=valid_times_0&variable=radar_reflectivity'
				)
			).rejects.toThrow(/Invalid meta\.json/);
		});

		it('rejects meta.json with unparseable reference_time', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: true,
					json: async () => ({
						reference_time: 'nope',
						valid_times: ['2026-09-02T12:00Z'],
						variables: ['radar_reflectivity']
					})
				})
			);

			await expect(
				parseMetaJson(
					'https://meteo.test/data_spatial/arso_badref/latest.json?time_step=valid_times_0&variable=radar_reflectivity'
				)
			).rejects.toThrow(/Invalid meta\.json/);
		});

		it('rejects non-finite valid_times index', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: true,
					json: async () => ({
						reference_time: '2026-09-02T12:00:00Z',
						valid_times: ['2026-09-02T12:00Z'],
						variables: ['radar_reflectivity']
					})
				})
			);

			await expect(
				parseMetaJson(
					'https://meteo.test/data_spatial/arso_nan/latest.json?time_step=valid_times_NaN&variable=radar_reflectivity'
				)
			).rejects.toThrow(/Invalid valid_times index/);
		});

		it('rejects meta.json hosts outside the allowlist', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: true,
					json: async () => ({
						reference_time: '2026-09-02T12:00:00Z',
						valid_times: ['2026-09-02T12:00Z'],
						variables: ['radar_reflectivity']
					})
				})
			);

			await expect(
				parseMetaJson(
					'https://evil.example/data_spatial/x/latest.json?time_step=valid_times_0&variable=radar_reflectivity',
					['https://meteo.test']
				)
			).rejects.toThrow(/meta\.json host not allowed/);
		});

		it('rejects cleartext meta.json when an allowlist is set', async () => {
			await expect(
				parseMetaJson(
					'http://127.0.0.1:4001/data_spatial/x/latest.json?time_step=valid_times_0&variable=radar_reflectivity',
					['https://meteo.test']
				)
			).rejects.toThrow(/meta\.json host not allowed/);
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
