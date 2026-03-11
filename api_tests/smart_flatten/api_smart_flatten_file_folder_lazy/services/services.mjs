/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_file_folder_lazy/services/services.mjs
 *	@Date: 2026-02-25T21:09:47-08:00 (1772082587)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:20 -08:00 (1772425280)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test fixture: same-name file inside a folder that also has a same-name subfolder.
 * Purpose: triggers the `attachedKeys.length > 0` branch in modes-processor.mjs
 * (lazy_materializeFunc, line ~1514), where a wrapper pre-populated with these
 * exports is returned directly as nestedValue.
 * @module api_smart_flatten_file_folder_lazy.services
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
