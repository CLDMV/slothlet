const { self, context, reference } = await import(
	new URL(`../../src/slothlet.mjs?_slothlet=${new URL(import.meta.url).searchParams.get("_slothlet") || ""}`, import.meta.url).href
);

/**
 * Stub for cleanEndpoint. Returns the function name as a string.
 * @param {string} endpoint
 * @param {string|boolean} siteKey
 * @param {object} variables
 * @param {string|boolean} apiEndPointVersionOverride
 * @param {string|boolean} apiEndPointTypeOverride
 * @returns {string}
 * @example
 * cleanEndpoint('sites_list', { site: 'default' }); // "cleanEndpoint"
 */
export function cleanEndpoint(
	endpoint,
	siteKey = false,
	variables = {},
	apiEndPointVersionOverride = false,
	apiEndPointTypeOverride = false
) {
	return "cleanEndpoint";
}

/**
 * Stub for buildUrlWithParams. Returns the function name as a string.
 * @param {string} str
 * @param {Object} params
 * @returns {string}
 * @example
 * buildUrlWithParams("10.0.0.1", { foo: "bar" }); // "buildUrlWithParams"
 */
export function buildUrlWithParams(str, params = {}) {
	return "buildUrlWithParams";
}
