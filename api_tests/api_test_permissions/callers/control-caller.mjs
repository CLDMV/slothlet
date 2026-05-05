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

let cachedAddRuleRef = null;

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

/**
 * Attempt to bypass internal permission routing with descriptor reflection.
 * Used in tests verifying Object/Reflect descriptor reads do not expose
 * raw unproxied slothlet namespaces.
 *
 * @param {object} rule - Permission rule to register.
 * @returns {string} Registered rule ID.
 * @example
 * api.controlCaller.callAddRuleViaDescriptorBypass({ caller: "**", target: "db.**", effect: "deny" });
 */
export const callAddRuleViaDescriptorBypass = (rule) => {
	const permissionsDescriptor = Object.getOwnPropertyDescriptor(self.slothlet, "permissions");
	const permissionsNamespace = permissionsDescriptor?.value;
	const addRuleDescriptor = Reflect.getOwnPropertyDescriptor(permissionsNamespace, "addRule");
	return addRuleDescriptor.value(rule);
};

/**
 * Warm one i18n alias and then read a nested property through the other alias.
 * Used in tests verifying permission checks stay bound to the active route path
 * even when two routes reference the same underlying function.
 *
 * @returns {string} Function name for the translate alias.
 * @example
 * const name = api.controlCaller.callReadTranslateNameAfterTWarmup();
 */
export const callReadTranslateNameAfterTWarmup = () => {
	self.slothlet.i18n.t;
	return self.slothlet.i18n.translate.name;
};

/**
 * Cache a reference to slothlet.permissions.addRule for later invocation.
 * Used in tests verifying invocation-time permission checks for cached
 * callable internal slothlet routes.
 *
 * @returns {string} Type of cached reference.
 * @example
 * const type = api.controlCaller.cacheAddRuleReference();
 */
export const cacheAddRuleReference = () => {
	cachedAddRuleRef = self.slothlet.permissions.addRule;
	return typeof cachedAddRuleRef;
};

/**
 * Invoke the previously cached slothlet.permissions.addRule reference.
 *
 * @param {object} rule - Permission rule to register.
 * @returns {string} Registered rule ID.
 * @example
 * const id = api.controlCaller.callCachedAddRuleReference({ caller: "**", target: "db.**", effect: "deny" });
 */
export const callCachedAddRuleReference = (rule) => cachedAddRuleRef(rule);
