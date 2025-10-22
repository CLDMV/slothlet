export namespace extract {
	/**
	 * Extracts data from a source.
	 * @function data
	 * @public
	 * @returns {string} Data extraction result
	 * @example // ESM usage via slothlet API
	 * import slothlet from '@cldmv/slothlet';
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.util.extract.data()); // 'data'
	 *
	 * @example // ESM usage via slothlet API (inside async function)
	 * async function example() {
	 *   const { default: slothlet } = await import("@cldmv/slothlet");
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.util.extract.data()); // 'data'
	 * }
	 *
	 * @example // CJS usage via slothlet API (top-level)
	 * let slothlet;
	 * (async () => {
	 *   ({ slothlet } = await import("@cldmv/slothlet"));
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.util.extract.data()); // 'data'
	 * })();
	 *
	 * @example // CJS usage via slothlet API (inside async function)
	 * const slothlet = require("@cldmv/slothlet");
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.util.extract.data()); // 'data'
	 */
	function data(): string;
	/**
	 * Extracts sections from content.
	 * @function section
	 * @public
	 * @returns {string} Section extraction result
	 * @example // ESM usage via slothlet API
	 * import slothlet from '@cldmv/slothlet';
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.util.extract.section()); // 'section'
	 *
	 * @example // ESM usage via slothlet API (inside async function)
	 * async function example() {
	 *   const { default: slothlet } = await import("@cldmv/slothlet");
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.util.extract.section()); // 'section'
	 * }
	 *
	 * @example // CJS usage via slothlet API (top-level)
	 * let slothlet;
	 * (async () => {
	 *   ({ slothlet } = await import("@cldmv/slothlet"));
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.util.extract.section()); // 'section'
	 * })();
	 *
	 * @example // CJS usage via slothlet API (inside async function)
	 * const slothlet = require("@cldmv/slothlet");
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.util.extract.section()); // 'section'
	 */
	function section(): string;
	/**
	 * Extracts NVR (Network Video Recorder) sections.
	 * @function NVRSection
	 * @public
	 * @returns {string} NVR section extraction result
	 * @example // ESM usage via slothlet API
	 * import slothlet from '@cldmv/slothlet';
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.util.extract.NVRSection()); // 'NVRSection'
	 *
	 * @example // ESM usage via slothlet API (inside async function)
	 * async function example() {
	 *   const { default: slothlet } = await import("@cldmv/slothlet");
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.util.extract.NVRSection()); // 'NVRSection'
	 * }
	 *
	 * @example // CJS usage via slothlet API (top-level)
	 * let slothlet;
	 * (async () => {
	 *   ({ slothlet } = await import("@cldmv/slothlet"));
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.util.extract.NVRSection()); // 'NVRSection'
	 * })();
	 *
	 * @example // CJS usage via slothlet API (inside async function)
	 * const slothlet = require("@cldmv/slothlet");
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.util.extract.NVRSection()); // 'NVRSection'
	 */
	function NVRSection(): string;
	/**
	 * Parses device names from input.
	 * @function parseDeviceName
	 * @public
	 * @returns {string} Device name parsing result
	 * @example // ESM usage via slothlet API
	 * import slothlet from '@cldmv/slothlet';
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.util.extract.parseDeviceName()); // 'parseDeviceName'
	 *
	 * @example // ESM usage via slothlet API (inside async function)
	 * async function example() {
	 *   const { default: slothlet } = await import("@cldmv/slothlet");
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.util.extract.parseDeviceName()); // 'parseDeviceName'
	 * }
	 *
	 * @example // CJS usage via slothlet API (top-level)
	 * let slothlet;
	 * (async () => {
	 *   ({ slothlet } = await import("@cldmv/slothlet"));
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.util.extract.parseDeviceName()); // 'parseDeviceName'
	 * })();
	 *
	 * @example // CJS usage via slothlet API (inside async function)
	 * const slothlet = require("@cldmv/slothlet");
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.util.extract.parseDeviceName()); // 'parseDeviceName'
	 */
	function parseDeviceName(): string;
}
//# sourceMappingURL=extract.d.mts.map
