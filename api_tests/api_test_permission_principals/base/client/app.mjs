/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permission_principals/base/client/app.mjs
 *	@Date: 2026-09-26 22:18:59 -07:00 (1790486339)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-26 22:18:59 -07:00 (1790486339)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * The calling module the principal tests enforce against (#459).
 */

/**
 * List a project's files.
 * @param {string} projectId - Project id.
 * @returns {*} The gated call's result.
 */
export const files = (projectId) => self.project.files.list(projectId);

/**
 * Export a project's report.
 * @param {string} projectId - Project id.
 * @returns {*} The gated call's result.
 */
export const report = (projectId) => self.reports.exporter.run(projectId);

/**
 * Construct a gadget.
 * @param {string} label - Gadget label.
 * @returns {object} The gadget.
 */
export const build = (label) => new self.widgets.Gadget(label);

/**
 * Capture a reference to the files leaf, then invoke it later.
 * @param {string} projectId - Project id.
 * @returns {Promise<*>} The gated call's result.
 */
export const captured = async (projectId) => {
	const ref = self.project.files.list;
	await null;
	return ref(projectId);
};

/**
 * Try to register a principal from this (base) module.
 * @param {string} name - Principal name.
 * @returns {void}
 */
export const claim = (name) => self.slothlet.permissions.principal.register(name, { key: () => "k", resolve: () => ({}) });

/**
 * Try to invalidate a principal from this (base) module.
 * @param {string} name - Principal name.
 * @returns {boolean} Result of invalidate.
 */
export const invalidate = (name) => self.slothlet.permissions.principal.invalidate(name);

/**
 * Try to unregister a principal from this (base) module.
 * @param {string} name - Principal name.
 * @returns {boolean} Result of unregister.
 */
export const unregister = (name) => self.slothlet.permissions.principal.unregister(name);
