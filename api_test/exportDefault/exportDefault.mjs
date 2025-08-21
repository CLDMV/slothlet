/**
 * exportDefault module for testing default function and named exports.
 * @returns {function} exportDefault API function with extra method.
 * @example Default and named export usage
 * ```javascript
 * api.exportDefault(); // 'exportDefault default'
 * api.exportDefault.extra();
 * api.exportDefault.extra(); // 'extra method' (named export)
 * ```
 */
function exportDefault() {
	return "exportDefault default";
}
/**
 * Extra method attached to exportDefault function.
 * @returns {string}
 * @example
 * ```javascript
 * api.exportDefault();
 * api.exportDefault.extra(); // 'extra method'
 * ```
 */
exportDefault.extra = function () {
	return "extra method";
};
export default exportDefault;

/**
 * Named export for extra method. This will override the extra method on the default export.
 * @returns {string}
 * @example
 * ```javascript
 * api.exportDefault.extra(); // 'extra method overridden'
 * ```
 */
export function extra() {
	return "extra method overridden";
}
