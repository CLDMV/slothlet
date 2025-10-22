export namespace selfObject {
	/**
	 * Adds two numbers using live-binding through self.math.add reference.
	 * Tests that self-references work correctly in the slothlet loader system.
	 * @function addViaSelf
	 * @public
	 *
	 * @param {number} a - The first number to add.
	 * @param {number} b - The second number to add.
	 * @returns {number} The sum of a and b, or NaN if self.math.add is not available.
	 *
	 * @example // ESM usage via slothlet API
	 * import slothlet from '@cldmv/slothlet';
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
	 *
	 * @example // ESM usage via slothlet API (inside async function)
	 * async function example() {
	 *   const { default: slothlet } = await import("@cldmv/slothlet");
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
	 * }
	 *
	 * @example // CJS usage via slothlet API (top-level)
	 * let slothlet;
	 * (async () => {
	 *   ({ slothlet } = await import("@cldmv/slothlet"));
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
	 * })();
	 *
	 * @example // CJS usage via slothlet API (inside async function)
	 * const slothlet = require("@cldmv/slothlet");
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
	 */
	function addViaSelf(a: number, b: number): number;
}
//# sourceMappingURL=self-object.d.mts.map
