/**
 * @fileoverview A module that adds a folder to the api, which emits lifecycle events in its own call.
 * @module api_test_lifecycle_results/app
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Add a folder under a path, as this module.
 * @param {string} apiPath - Where to mount it.
 * @param {string} dir - The folder.
 * @returns {Promise<void>} Settles once mounted.
 */
export async function mount(apiPath, dir) {
	await self.slothlet.api.add(apiPath, dir);
}
