import { pad } from '.';

import {
	DATA_RELEVANT_PARAMS,
	DOMAIN_META_REGEX,
	OM_PREFIX_REGEX,
	TILE_SUFFIX_REGEX,
	TIME_STEP_REGEX
} from './constants';

import { DomainMetaDataJson, ParsedUrlComponents, TileIndex } from '../types';

/** When set, meta.json fetches must be https and match one of these origins. */
export function assertMetaJsonFetchAllowed(
	jsonUrl: string,
	allowedOrigins: readonly string[] | undefined
): void {
	if (!allowedOrigins?.length) return;
	let u: URL;
	try {
		u = new URL(jsonUrl);
	} catch {
		throw new Error(`meta.json host not allowed: invalid URL`);
	}
	if (u.protocol !== 'https:' || !allowedOrigins.includes(u.origin)) {
		throw new Error(`meta.json host not allowed: ${u.protocol}//${u.host}`);
	}
	if (!u.pathname.includes('/data_spatial/')) {
		throw new Error(`meta.json path not allowed: ${u.pathname}`);
	}
}

const parseTileIndex = (url: string): { tileIndex: TileIndex | null; remainingUrl: string } => {
	const match = url.match(TILE_SUFFIX_REGEX);
	if (!match) {
		return { tileIndex: null, remainingUrl: url };
	}

	return {
		tileIndex: {
			z: parseInt(match[1]),
			x: parseInt(match[2]),
			y: parseInt(match[3])
		},
		remainingUrl: url.slice(0, match.index)
	};
};

/**
 * Parses URL structure - this is always done internally.
 * Handles om:// prefix, query params, and tile coordinates.
 *
 * The URL structure is:
 * om://<baseUrl>?<params>/<z>/<x>/<y>  (tile request)
 * om://<baseUrl>?<params>              (tilejson request)
 * om://<baseUrl>/<z>/<x>/<y>           (tile request, no params)
 * om://<baseUrl>                       (tilejson request, no params)
 */
export const parseUrlComponents = (url: string): ParsedUrlComponents => {
	const { tileIndex, remainingUrl } = parseTileIndex(url);

	const match = remainingUrl.match(OM_PREFIX_REGEX);
	if (!match) {
		throw new Error(`Invalid OM protocol URL: ${url}`);
	}

	const [, baseUrl, queryString] = match;
	const params = new URLSearchParams(queryString ?? '');

	// Build state key from baseUrl + only data-affecting params
	const dataParams = new URLSearchParams();
	for (const [key, value] of params) {
		if (DATA_RELEVANT_PARAMS.has(key)) {
			dataParams.set(key, value);
		}
	}
	const paramString = dataParams.toString();
	const fileAndVariableKey = paramString ? `${baseUrl}?${paramString}` : baseUrl;

	return { baseUrl, params, fileAndVariableKey, tileIndex };
};

/**
 * Returns positive amount if modifier is '+' or 'undefined', returns negative amount otherwise
 */
const getModifiedAmount = (amount: number, modifier = '+') => {
	if (modifier === '+' || modifier === undefined) return amount;
	return -amount;
};

// {meta}.json files are cached for 60 seconds
const metaDataCache = new Map<string, Promise<DomainMetaDataJson>>();
const META_CACHE_MS = 60_000;

function assertMetaCatalog(data: unknown, jsonUrl: string): DomainMetaDataJson {
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		throw new Error(`Invalid meta.json: expected catalog object (${jsonUrl})`);
	}
	const catalog = data as DomainMetaDataJson;
	if (
		typeof catalog.reference_time !== 'string' ||
		Number.isNaN(Date.parse(catalog.reference_time))
	) {
		throw new Error(`Invalid meta.json: bad reference_time (${jsonUrl})`);
	}
	if (!Array.isArray(catalog.valid_times) || catalog.valid_times.length === 0) {
		throw new Error(`Invalid meta.json: missing valid_times (${jsonUrl})`);
	}
	if (catalog.valid_times.length > 10_000) {
		throw new Error(`Invalid meta.json: valid_times too long (${jsonUrl})`);
	}
	for (const t of catalog.valid_times) {
		if (typeof t !== 'string' || Number.isNaN(Date.parse(t))) {
			throw new Error(`Invalid meta.json: bad valid_times entry (${jsonUrl})`);
		}
	}
	return catalog;
}

function fetchMetaJson(
	jsonUrl: string,
	bypassCache: boolean,
	allowedOrigins?: readonly string[]
): Promise<DomainMetaDataJson> {
	assertMetaJsonFetchAllowed(jsonUrl, allowedOrigins);
	if (!bypassCache) {
		const hit = metaDataCache.get(jsonUrl);
		if (hit) return hit;
	}
	const pending = fetch(jsonUrl, { cache: 'no-store' })
		.then(async (response) => {
			if (!response.ok) {
				throw new Error(`Failed to fetch meta.json (${response.status}): ${jsonUrl}`);
			}
			return assertMetaCatalog(await response.json(), jsonUrl);
		})
		.catch((err) => {
			if (metaDataCache.get(jsonUrl) === pending) metaDataCache.delete(jsonUrl);
			throw err;
		});
	metaDataCache.set(jsonUrl, pending);
	setTimeout(() => {
		if (metaDataCache.get(jsonUrl) === pending) metaDataCache.delete(jsonUrl);
	}, META_CACHE_MS);
	return pending;
}

async function catalogForValidTimesIndex(
	jsonUrl: string,
	catalog: DomainMetaDataJson,
	requestedIndex: number,
	allowedOrigins?: readonly string[]
): Promise<DomainMetaDataJson> {
	if (catalog.valid_times?.[requestedIndex] !== undefined) return catalog;
	metaDataCache.delete(jsonUrl);
	return fetchMetaJson(jsonUrl, true, allowedOrigins);
}

export const parseMetaJson = async (
	omUrl: string,
	allowedOrigins?: readonly string[]
) => {
	let date = new Date();
	const url = omUrl.replace('om://', '');

	// jsonUrl should be everything until ".json" of the current url (inclusive)
	const jsonIndex = url.indexOf('.json');
	const jsonUrl = url.slice(0, jsonIndex + '.json'.length);

	let metaResult = await fetchMetaJson(jsonUrl, false, allowedOrigins);

	const { meta } = url.match(DOMAIN_META_REGEX)?.groups as {
		meta: string; // E.G. latest | in-progress
	};

	const parsedOmUrl = new URL(url);
	const timeStep = parsedOmUrl.searchParams.get('time_step');
	const timeStepMatch = timeStep?.match(TIME_STEP_REGEX);
	if (timeStep && timeStepMatch) {
		const { capture, modifier, amountAndUnit } = timeStepMatch.groups as {
			capture: string;
			modifier: undefined | '+' | '-';
			amountAndUnit: undefined | string;
		};
		if (capture === 'current_time') {
			if (amountAndUnit) {
				const splitAmountAndUnit = amountAndUnit.match(/[a-zA-Z]+|[0-9]+/g);
				if (splitAmountAndUnit) {
					const amount = splitAmountAndUnit
						? getModifiedAmount(Number(splitAmountAndUnit[0]), modifier)
						: 0;

					const unit = splitAmountAndUnit[1] ?? undefined;

					if (amount && unit === 'M') {
						date.setMinutes(date.getMinutes() + amount);
					} else if (amount && unit === 'H') {
						date.setHours(date.getHours() + amount);
					} else if (amount && unit === 'd') {
						date.setDate(date.getDate() + amount);
					} else if (amount && unit === 'm') {
						date.setMonth(date.getMonth() + amount);
					} else {
						throw new Error('Modifier or amount not supported ');
					}
				} else {
					throw new Error('Could not parse amount and or unit ');
				}
			} else {
				// it will take the current hour selected with date object at the beginning of this function
			}
		} else if (capture === 'valid_times') {
			if (amountAndUnit) {
				const requested = Number(amountAndUnit);
				if (!Number.isFinite(requested) || requested < 0) {
					throw new Error(`Invalid valid_times index: ${amountAndUnit}`);
				}
				metaResult = await catalogForValidTimesIndex(
					jsonUrl,
					metaResult,
					requested,
					allowedOrigins
				);
				const times = metaResult.valid_times;
				if (!times?.length) {
					throw new Error(`valid_times index ${requested} out of range (len=0)`);
				}
				if (requested >= times.length) {
					throw new Error(
						`valid_times index ${requested} out of range (len=${times.length})`
					);
				}
				const raw = times[requested];
				date = new Date(raw);
				if (Number.isNaN(date.getTime())) {
					throw new Error(`Invalid valid_times[${requested}]: ${raw}`);
				}
			} else {
				throw new Error('Missing valid times index');
			}
		}
	} else {
		// if no time_step defined, then take the first valid time
		date = new Date(metaResult.valid_times[0]);
	}
	const modelRun = new Date(metaResult.reference_time);
	parsedOmUrl.searchParams.delete('time_step'); // delete time_step urlSearchParam since it has no effect on map

	// need to return a URL that is not percent encoded
	return decodeURIComponent(
		'om://' +
			parsedOmUrl.href.replace(
				`${meta}.json`,
				`${modelRun.getUTCFullYear()}/${pad(modelRun.getUTCMonth() + 1)}/${pad(modelRun.getUTCDate())}/${pad(modelRun.getUTCHours())}${pad(modelRun.getUTCMinutes())}Z/${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}.om`
			)
	);
};
