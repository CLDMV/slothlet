/**
 * @fileoverview Data extraction utilities for testing nested module structure. Internal file (not exported in package.json).
 * @module api_test.util.extract
 * @memberof module:api_test
 */

// Runtime imports (unused but required for API structure)
// import { self, context, reference } from "@cldmv/slothlet/runtime";

/**
 * Data extraction API object with various parsing and extraction methods.
 * This module tests slothlet's ability to handle nested folder structures.
 * Accessed as `api.util.extract` in the slothlet API.
 * @alias module:api_test.util.extract
 * @public
 * @property {Function} data - Extracts data
 * @property {Function} section - Extracts sections
 * @property {Function} NVRSection - Extracts NVR sections
 * @property {Function} parseDeviceName - Parses device names
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
export const extract =
	/** @lends extract */
	{
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
		data() {
			return "data";
		},
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
		section() {
			return "section";
		},
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
		NVRSection() {
			return "NVRSection";
		},
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
		parseDeviceName() {
			return "parseDeviceName";
		}
	};
