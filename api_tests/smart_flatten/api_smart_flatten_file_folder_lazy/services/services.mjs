/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_file_folder_lazy/services/services.mjs
 *	@Date: 2026-02-25 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Test fixture: same-name file inside a folder that also has a same-name subfolder.
 * Purpose: triggers the `attachedKeys.length > 0` branch in modes-processor.mjs
 * (lazy_materializeFunc, line ~1514), where a wrapper pre-populated with these
 * exports is returned directly as nestedValue.
 */

/**
 * Returns a string identifying this service implementation.
 * @returns {string} Service identifier.
 * @example
 * getService(); // "service-file-impl"
 */
export function getService() {
	return "service-file-impl";
}

/**
 * Returns the service version string.
 * @returns {string} Version string.
 * @example
 * getServiceVersion(); // "v1"
 */
export function getServiceVersion() {
	return "v1";
}
