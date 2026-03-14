/**
 * Registers a Slothlet instance and creates its per-instance lifecycle capability token.
 *
 * Safe to call multiple times on the same instance (idempotent) — subsequent calls are
 * silently ignored, preserving the original token. This handles the reload code path where
 * `load()` is called again on the same Slothlet object.
 *
 * @param {object} slothlet - The Slothlet instance to register.
 * @returns {void}
 * @package
 *
 * @example
 * // Called once (or on reload) in Slothlet.load():
 * registerInstance(this);
 */
export function registerInstance(slothlet: object): void;
/**
 * Returns the per-instance capability token for the given Slothlet instance.
 *
 * Used internally by `lifecycle.mjs` (emit dispatch) and `modes-processor.mjs`
 * (direct tagSystemMetadata call for folder wrappers). Requires a live registered
 * Slothlet instance — cannot be exploited without one.
 *
 * @param {object} slothlet - A registered Slothlet instance.
 * @returns {symbol|undefined} The instance token, or undefined if not registered.
 * @package
 *
 * @example
 * handler(data, getInstanceToken(this.slothlet));
 */
export function getInstanceToken(slothlet: object): symbol | undefined;
/**
 * Verifies that `token` is the registered capability token for the given Slothlet instance.
 *
 * Used by `metadata.mjs` inside `tagSystemMetadata()` to reject calls that did not
 * originate from the internal lifecycle dispatch path.
 *
 * @param {object} slothlet - A registered Slothlet instance.
 * @param {*} token - The token value to verify.
 * @returns {boolean} `true` only if `token` is the exact Symbol registered for `slothlet`.
 * @package
 *
 * @example
 * if (!verifyToken(this.slothlet, token)) {
 *   throw new this.SlothletError("METADATA_LIFECYCLE_BYPASS", ...);
 * }
 */
export function verifyToken(slothlet: object, token: any): boolean;
//# sourceMappingURL=lifecycle-token.d.mts.map