/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/callers/internal-proxy-helper.mjs
 *	@Date: 2026-05-06 00:00:00 -07:00 (1778041200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-06 00:00:00 -07:00 (1778041200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Read a symbol-keyed property from the slothlet permissions namespace.
 * Exercises internal route proxy `get` trap for non-string properties.
 *
 * @returns {string|null} Symbol-tag value when present.
 * @example
 * const tag = api.internalProxyHelper.readPermissionsSymbolValue();
 */
export const readPermissionsSymbolValue = () => {
	return self.slothlet.permissions[Symbol.toStringTag] ?? null;
};

/**
 * Read a symbol-keyed property descriptor from the slothlet permissions namespace.
 * Exercises internal route proxy `getOwnPropertyDescriptor` trap for non-string properties.
 *
 * @returns {boolean} True when descriptor lookup completed.
 * @example
 * const ok = api.internalProxyHelper.readPermissionsSymbolDescriptor();
 */
export const readPermissionsSymbolDescriptor = () => {
	const descriptor = Object.getOwnPropertyDescriptor(self.slothlet.permissions, Symbol.toStringTag);
	return descriptor === undefined || typeof descriptor === "object";
};

/**
 * Define and then read a symbol-keyed descriptor on permissions namespace.
 * Ensures descriptor lookup path handles non-string keys with an existing descriptor.
 *
 * @returns {boolean} True when symbol descriptor is resolved with expected value.
 * @example
 * const ok = api.internalProxyHelper.defineAndReadPermissionsSymbolDescriptor();
 */
export const defineAndReadPermissionsSymbolDescriptor = () => {
	const probe = Symbol.for("slothlet.internalProxyHelper.probe");
	self.slothlet.permissions[probe] = 123;
	const descriptor = Object.getOwnPropertyDescriptor(self.slothlet.permissions, probe);
	return descriptor?.value === 123;
};

/**
 * Construct a warning object through a slothlet internal route.
 * Exercises internal route proxy `construct` trap.
 *
 * @returns {boolean} True when construction produced an object instance.
 * @example
 * const built = api.internalProxyHelper.constructWarningThroughDiag();
 */
export const constructWarningThroughDiag = () => {
	const warning = new self.slothlet.diag.SlothletWarning("WARNING_RESERVED_PROPERTY_CONFLICT");
	return warning instanceof self.slothlet.diag.SlothletWarning;
};

/**
 * Trigger INVALID_METADATA_KEY by passing an empty metadata key.
 * Exercises global metadata key validation.
 *
 * @returns {void}
 * @example
 * api.internalProxyHelper.callSetGlobalWithEmptyKey();
 */
export const callSetGlobalWithEmptyKey = () => {
	self.slothlet.metadata.setGlobal("", "x");
};

/**
 * Trigger INVALID_ARGUMENT by passing a non-string/non-object keyOrObj.
 * Exercises setGlobal argument validation.
 *
 * @returns {void}
 * @example
 * api.internalProxyHelper.callSetGlobalWithInvalidType();
 */
export const callSetGlobalWithInvalidType = () => {
	self.slothlet.metadata.setGlobal(7, "x");
};

/**
 * Read the permissions namespace object from inside an API module.
 * Used for denied namespace traversal tests.
 *
 * @returns {object} Permissions namespace proxy.
 * @example
 * const ns = api.internalProxyHelper.readPermissionsNamespace();
 */
export const readPermissionsNamespace = () => {
	return self.slothlet.permissions;
};

/**
 * Read diagnostics hook-enabled accessor through descriptor invocation.
 * Exercises configurable accessor getter wrapping on internal route descriptors.
 *
 * @returns {boolean} Hook manager enabled state.
 * @example
 * const enabled = api.internalProxyHelper.readDiagHookEnabledViaDescriptorGetter();
 */
export const readDiagHookEnabledViaDescriptorGetter = () => {
	const descriptor = Object.getOwnPropertyDescriptor(self.slothlet.diag.hook, "enabled");
	return descriptor.get();
};

/**
 * Read the slothlet version string via the internal route proxy.
 * The version property is a primitive string; exercises line-409 else branch
 * (canTraverseInternalNamespace returns true but result is not object/function).
 *
 * @returns {string} The slothlet version string.
 * @example
 * const v = api.internalProxyHelper.readSlothletVersion();
 */
export const readSlothletVersion = () => {
	return self.slothlet.version;
};

/**
 * Define an accessor with only a setter and invoke it via descriptor reflection.
 * Exercises setter-wrapping branches in internal route descriptor handling.
 *
 * @returns {number} Captured value written through the wrapped setter.
 * @example
 * const value = api.internalProxyHelper.writeSyntheticSetterViaDescriptor(42);
 */
export const writeSyntheticSetterViaDescriptor = (nextValue) => {
	let captured = 0;
	Object.defineProperty(self.slothlet.permissions, "__syntheticSetter", {
		configurable: true,
		enumerable: true,
		set(value) {
			captured = value;
		}
	});

	const descriptor = Object.getOwnPropertyDescriptor(self.slothlet.permissions, "__syntheticSetter");
	descriptor.set(nextValue);
	return captured;
};
