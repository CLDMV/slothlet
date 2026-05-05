/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/callers/control-caller.mjs
 *	@Date: 2026-04-21 06:45:00 -07:00 (1776736700)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-21 06:45:00 -07:00 (1776736700)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Attempt to enable the permission system via inter-module call.
 * Used in tests verifying that control.** is protected even when permissions are disabled.
 *
 * @returns {void}
 * @example
 * api.callers.controlCaller.callEnable();
 */
export const callEnable = () => self.slothlet.permissions.control.enable();

/**
 * Attempt to disable the permission system via inter-module call.
 * Used in tests verifying that control.** is protected even when permissions are disabled.
 *
 * @returns {void}
 * @example
 * api.callers.controlCaller.callDisable();
 */
export const callDisable = () => self.slothlet.permissions.control.disable();

/**
 * Attempt to add a permission rule via inter-module call.
 * Used in tests verifying that addRule is permission-gated for module callers.
 *
 * @param {object} rule - Permission rule to register.
 * @returns {string} Registered rule ID.
 * @example
 * api.controlCaller.callAddRule({ caller: "**", target: "db.**", effect: "deny" });
 */
export const callAddRule = (rule) => self.slothlet.permissions.addRule(rule);

/**
 * Attempt to remove a permission rule via inter-module call.
 * Used in tests verifying that removeRule is permission-gated for module callers.
 *
 * @param {string} ruleId - Permission rule ID.
 * @returns {boolean} True when the rule is removed.
 * @example
 * api.controlCaller.callRemoveRule("perm-1");
 */
export const callRemoveRule = (ruleId) => self.slothlet.permissions.removeRule(ruleId);

/**
 * Attempt to set global metadata via inter-module call.
 * Used in tests verifying that metadata routes can be permission-gated for module callers.
 *
 * @param {string} key - Metadata key.
 * @param {unknown} value - Metadata value.
 * @returns {void}
 * @example
 * api.controlCaller.callSetGlobalMetadata("tenant", "alpha");
 */
export const callSetGlobalMetadata = (key, value) => self.slothlet.metadata.setGlobal(key, value);

/**
 * Attempt to set i18n language via inter-module call.
 * Used in tests verifying non-permissions slothlet routes can be permission-gated.
 *
 * @param {string} lang - Language tag.
 * @returns {void}
 * @example
 * api.controlCaller.callSetLanguage("en-us");
 */
export const callSetLanguage = (lang) => self.slothlet.i18n.setLanguage(lang);

/**
 * Read slothlet version via inter-module route access.
 * Used in tests verifying primitive property routes are permission-gated.
 *
 * @returns {string} Slothlet version string.
 * @example
 * const version = api.controlCaller.callReadVersion();
 */
export const callReadVersion = () => self.slothlet.version;
