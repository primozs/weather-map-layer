import { WeatherMapLayerFileReader } from '../om-file-reader';
import { describe, expect, it, vi } from 'vitest';

describe('WeatherMapLayerFileReader.setToOmFile', () => {
	it('does not clear block cache when the .om URL changes', async () => {
		const clear = vi.fn(async () => {});
		const reader = new WeatherMapLayerFileReader({
			cache: { clear, keyKind: 'string', blockSize: () => 65536, get: vi.fn(), size: vi.fn(), prefetch: vi.fn() }
		});

		await expect(reader.setToOmFile('https://example.com/a.om')).rejects.toThrow();
		expect(clear).not.toHaveBeenCalled();

		await expect(reader.setToOmFile('https://example.com/a.om')).rejects.toThrow();
		expect(clear).not.toHaveBeenCalled();

		// Different URL — keep URL-keyed neighbor prefetch / prior file blocks.
		await expect(reader.setToOmFile('https://example.com/b.om')).rejects.toThrow();
		expect(clear).not.toHaveBeenCalled();
	});
});
