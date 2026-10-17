import {
	assertMetaCatalog,
	assertMetaJsonFetchAllowed,
	parseMetaJson
} from '../utils/parse-url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGIN = 'https://maps.example';
const ALLOWED = [ORIGIN] as const;

describe('assertMetaJsonFetchAllowed', () => {
	it('no-ops when allowlist is unset or empty', () => {
		expect(() =>
			assertMetaJsonFetchAllowed(`${ORIGIN}/data_spatial/x/latest.json`, undefined)
		).not.toThrow();
		expect(() =>
			assertMetaJsonFetchAllowed(`${ORIGIN}/data_spatial/x/latest.json`, [])
		).not.toThrow();
	});

	it('allows https origin with /data_spatial/ path', () => {
		expect(() =>
			assertMetaJsonFetchAllowed(`${ORIGIN}/data_spatial/demo/latest.json`, ALLOWED)
		).not.toThrow();
	});

	it('rejects http', () => {
		expect(() =>
			assertMetaJsonFetchAllowed('http://maps.example/data_spatial/x/latest.json', ALLOWED)
		).toThrow(/host not allowed/);
	});

	it('rejects other origins', () => {
		expect(() =>
			assertMetaJsonFetchAllowed('https://evil.example/data_spatial/x/latest.json', ALLOWED)
		).toThrow(/host not allowed/);
	});

	it('rejects paths without /data_spatial/', () => {
		expect(() =>
			assertMetaJsonFetchAllowed(`${ORIGIN}/api/latest.json`, ALLOWED)
		).toThrow(/path not allowed/);
	});

	it('rejects invalid URLs', () => {
		expect(() => assertMetaJsonFetchAllowed('not-a-url', ALLOWED)).toThrow(/invalid URL/);
	});
});

describe('assertMetaCatalog', () => {
	const url = `${ORIGIN}/data_spatial/x/latest.json`;

	it('accepts a minimal valid catalog', () => {
		const catalog = assertMetaCatalog(
			{
				reference_time: '2026-09-02T12:00:00Z',
				valid_times: ['2026-09-02T12:00Z']
			},
			url
		);
		expect(catalog.valid_times).toHaveLength(1);
	});

	it('rejects non-objects', () => {
		expect(() => assertMetaCatalog(null, url)).toThrow(/expected catalog object/);
		expect(() => assertMetaCatalog([], url)).toThrow(/expected catalog object/);
	});

	it('rejects bad reference_time', () => {
		expect(() =>
			assertMetaCatalog({ reference_time: 'nope', valid_times: ['2026-09-02T12:00Z'] }, url)
		).toThrow(/bad reference_time/);
	});

	it('rejects empty valid_times', () => {
		expect(() =>
			assertMetaCatalog({ reference_time: '2026-09-02T12:00:00Z', valid_times: [] }, url)
		).toThrow(/missing valid_times/);
	});

	it('rejects valid_times longer than 10000', () => {
		expect(() =>
			assertMetaCatalog(
				{
					reference_time: '2026-09-02T12:00:00Z',
					valid_times: Array.from({ length: 10_001 }, () => '2026-09-02T12:00Z')
				},
				url
			)
		).toThrow(/valid_times too long/);
	});

	it('rejects non-date valid_times entries', () => {
		expect(() =>
			assertMetaCatalog(
				{ reference_time: '2026-09-02T12:00:00Z', valid_times: ['not-a-date'] },
				url
			)
		).toThrow(/bad valid_times entry/);
	});
});

describe('parseMetaJson meta fetch policy', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('refuses HTTP redirects when allowlist is set', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 302,
			url: `${ORIGIN}/data_spatial/demo/latest.json`
		});
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			parseMetaJson(
				`${ORIGIN}/data_spatial/demo/latest.json?time_step=valid_times_0&variable=temperature_2m`,
				undefined,
				ALLOWED
			)
		).rejects.toThrow(/meta\.json redirect refused/);

		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining('/data_spatial/demo/latest.json'),
			expect.objectContaining({ redirect: 'manual', cache: 'no-store' })
		);
	});

	it('rejects non-numeric valid_times index', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({
					reference_time: '2026-09-02T12:00:00Z',
					valid_times: ['2026-09-02T12:00Z'],
					variables: ['temperature_2m']
				})
			})
		);

		await expect(
			parseMetaJson(
				`${ORIGIN}/data_spatial/demo/latest.json?time_step=valid_times_nope&variable=temperature_2m`
			)
		).rejects.toThrow(/Invalid valid_times index/);
	});
});
