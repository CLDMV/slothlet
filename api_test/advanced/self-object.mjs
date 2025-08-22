const { self, context, reference } = await import(
	new URL(`../../src/slothlet.mjs?_slothlet=${new URL(import.meta.url).searchParams.get("_slothlet") || ""}`, import.meta.url).href
);

/**
 * advanced API module for testing slothlet loader (self reference).
 * @returns {object} selfObject API methods.
 * @example Test for ESM live-binding of `self` object from slothlet loader.
 * ```javascript
 * api.advanced.selfObject(2, 3); // 5
 * ```
 */
export const selfObject = {
	/**
	 * Returns the result of self.math.add(a, b) using live-binding.
	 * Adds two numbers.
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 * @example
	 * ```javascript
	 * addViaSelf(2, 3); // 5
	 * ```
	 */
	addViaSelf(a, b) {
		// console.log("self: ", self);
		// process.exit(0);
		if (self && typeof self.math?.add === "function") {
			return self.math.add(a, b);
		}
		throw new Error("self.math.add is not available");
	}
};
