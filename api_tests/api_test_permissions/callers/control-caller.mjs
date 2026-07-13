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
let cachedAddRuleDescriptorRef = null;
let cachedMaterializeGetRef = null;
let cachedMaterializedGetterRef = null;

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
 * Attempt to seal the permission control surface via inter-module call.
 * Used to verify that control.** (including seal) stays blocked for module callers.
 *
 * @returns {void}
 * @example
 * api.callers.controlCaller.callSeal();
 */
export const callSeal = () => self.slothlet.permissions.control.seal();

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

/**
 * Cache a slothlet.permissions.addRule function through descriptor reflection.
 * Used in tests verifying descriptor-returned callables still enforce permission
 * checks at invocation time.
 *
 * @returns {string} Type of cached reference.
 * @example
 * const type = api.controlCaller.cacheAddRuleDescriptorReference();
 */
export const cacheAddRuleDescriptorReference = () => {
	const permissionsDescriptor = Reflect.getOwnPropertyDescriptor(self.slothlet, "permissions");
	const permissionsNamespace = permissionsDescriptor?.value;
	const addRuleDescriptor = Reflect.getOwnPropertyDescriptor(permissionsNamespace, "addRule");
	cachedAddRuleDescriptorRef = addRuleDescriptor?.value;
	return typeof cachedAddRuleDescriptorRef;
};

/**
 * Invoke the previously cached descriptor-derived addRule reference.
 *
 * @param {object} rule - Permission rule to register.
 * @returns {string} Registered rule ID.
 * @example
 * const id = api.controlCaller.callCachedAddRuleDescriptorReference({ caller: "**", target: "db.**", effect: "deny" });
 */
export const callCachedAddRuleDescriptorReference = (rule) => cachedAddRuleDescriptorRef(rule);

/**
 * Read translate.length through descriptor reflection.
 * Used in tests verifying non-configurable primitive leaves still enforce
 * route permissions when accessed via getOwnPropertyDescriptor.
 *
 * @returns {number} Function arity from translate.length.
 * @example
 * const arity = api.controlCaller.callReadTranslateLengthViaDescriptor();
 */
export const callReadTranslateLengthViaDescriptor = () => {
	const translateFn = self.slothlet.i18n.translate;
	const descriptor = Object.getOwnPropertyDescriptor(translateFn, "length");
	return descriptor?.value;
};

/**
 * Read materialize.materialized by extracting and invoking its accessor getter
 * via descriptor reflection.
 * Used in tests verifying accessor descriptors cannot bypass internal route
 * permission enforcement.
 *
 * @returns {boolean} Current materialized state.
 * @example
 * const isMaterialized = api.controlCaller.callReadMaterializedViaDescriptorGetter();
 */
export const callReadMaterializedViaDescriptorGetter = () => {
	const materializeNamespace = self.slothlet.materialize;
	const descriptor = Object.getOwnPropertyDescriptor(materializeNamespace, "materialized");
	return descriptor?.get();
};

/**
 * Cache slothlet.materialize.get for later invocation.
 * Used in tests verifying frozen callable leaves re-check permission at call time.
 *
 * @returns {string} Type of cached reference.
 * @example
 * const type = api.controlCaller.cacheMaterializeGetReference();
 */
export const cacheMaterializeGetReference = () => {
	cachedMaterializeGetRef = self.slothlet.materialize.get;
	return typeof cachedMaterializeGetRef;
};

/**
 * Invoke the previously cached slothlet.materialize.get reference.
 *
 * @returns {object} Current materialization statistics.
 * @example
 * const stats = api.controlCaller.callCachedMaterializeGetReference();
 */
export const callCachedMaterializeGetReference = () => cachedMaterializeGetRef();

/**
 * Cache the slothlet.materialize.materialized getter function through descriptor reflection.
 * Used in tests verifying frozen accessor getters re-check permission at invocation time.
 *
 * @returns {string} Type of cached getter reference.
 * @example
 * const type = api.controlCaller.cacheMaterializedGetterReference();
 */
export const cacheMaterializedGetterReference = () => {
	const materializeNamespace = self.slothlet.materialize;
	const descriptor = Object.getOwnPropertyDescriptor(materializeNamespace, "materialized");
	cachedMaterializedGetterRef = descriptor?.get;
	return typeof cachedMaterializedGetterRef;
};

/**
 * Invoke the previously cached slothlet.materialize.materialized getter.
 *
 * @returns {boolean} Current materialized state.
 * @example
 * const done = api.controlCaller.callCachedMaterializedGetterReference();
 */
export const callCachedMaterializedGetterReference = () => cachedMaterializedGetterRef();

/**
 * Read permissions.control.enabled by extracting and invoking its accessor
 * getter via descriptor reflection.
 * Used in tests verifying configurable accessor descriptors cannot bypass
 * route-level permission enforcement.
 *
 * @returns {boolean} Current permissions enabled state.
 * @example
 * const enabled = api.controlCaller.callReadPermissionsEnabledViaDescriptorGetter();
 */
export const callReadPermissionsEnabledViaDescriptorGetter = () => {
	const controlNamespace = self.slothlet.permissions.control;
	const descriptor = Object.getOwnPropertyDescriptor(controlNamespace, "enabled");
	return descriptor?.get();
};

/**
 * Read the slothlet.permissions namespace object directly.
 * Used in tests verifying namespace object reads are permission-gated.
 *
 * @returns {object} The permissions namespace object.
 * @example
 * const permissionsNs = api.controlCaller.callReadPermissionsNamespace();
 */
export const callReadPermissionsNamespace = () => self.slothlet.permissions;
