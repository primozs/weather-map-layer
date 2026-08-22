import { WeatherMapLayerFileReader } from '../om-file-reader';
import { describe, expect, it, vi } from 'vitest';

describe('WeatherMapLayerFileReader.setToOmFile', () => {
	it('clears block cache when the .om URL changes', async () => {
		const clear = vi.fn(async () => {});
		const reader = new WeatherMapLayerFileReader({
			cache: { clear, keyKind: 'string', blockSize: () => 65536, get: vi.fn(), size: vi.fn(), prefetch: vi.fn() }
		});

		// First call opens a file — no prior URL, cache not cleared yet.
		await expect(reader.setToOmFile('https://example.com/a.om')).rejects.toThrow();
		expect(clear).not.toHaveBeenCalled();

		// Same URL again — still no clear.
		await expect(reader.setToOmFile('https://example.com/a.om')).rejects.toThrow();
		expect(clear).not.toHaveBeenCalled();

		// Different URL — stale blocks evicted.
		await expect(reader.setToOmFile('https://example.com/b.om')).rejects.toThrow();
		expect(clear).toHaveBeenCalledTimes(1);
	});
});
