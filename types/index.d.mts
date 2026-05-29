export default slothlet;
/**
 * Creates a slothlet API instance with live-binding context and AsyncLocalStorage support.
 * Automatically wraps all API functions with context isolation for multi-instance support.
 * @public
 * @async
 *
 * @param {import("./src/slothlet.mjs").SlothletOptions} [options={}] - Configuration options for the slothlet instance. See {@link SlothletOptions} for the full set.
 * @returns {Promise<import("./src/slothlet.mjs").SlothletAPI>} The bound API object with management methods
 *
 * @example // ESM
 * import slothlet from "@cldmv/slothlet";
 * const api = await slothlet({ base: './api', mode: 'lazy' });
 * const result = await api.math.add(2, 3); // 5
 *
 */
export function slothlet(options?: import("./src/slothlet.mjs").SlothletOptions): Promise<import("./src/slothlet.mjs").SlothletAPI>;
//# sourceMappingURL=index.d.mts.map