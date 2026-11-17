/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_internal_exports/table.mjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794675600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T13:30:55-08:00 (1794951055)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Host side of the internal-exports fixture: every export of slothlet's files that hands out a live
 * internal or changes slothlet's state, by the file's specifier; and the rows a module's use of each gives, and the
 * host's.
 * @module api_test_internal_exports.table
 */
import { fileURLToPath } from "node:url";

/**
 * The api folder.
 * @type {string}
 */
export const API_DIR = fileURLToPath(new URL("./api", import.meta.url));

/**
 * Where the host leaves the exports for the api file (see `api/held.mjs`).
 * @type {symbol}
 */
export const KEY = Symbol.for("@cldmv/slothlet.test.internalExports");

/**
 * The guarded exports, by the specifier of their file.
 * @type {Record<string, string[]>}
 */
export const EXPORTS = {
	"#helpers/instance-imports": [
		"registerOwnModule",
		"noteModuleFile",
		"setImportRefusal",
		"instanceImporters",
		"instanceCommonJSFiles",
		"instanceCommonJSVersion",
		"claimInstanceScope",
		"requireInInstance",
		"releaseInstanceScope",
		"setCallerCheck",
		"setScriptKey",
		"loadedScriptLookup",
		"loadedScriptText",
		"packageImporters",
		"recordedScriptHashes",
		"scriptKeyInstance",
		"installInstanceImportHooks"
	],
	"#handlers/frame-placement": [
		"runtime_importedLocations",
		"runtime_realComparablePath",
		"runtime_entryNames",
		"runtime_captureFrames",
		"forgetInstanceScripts",
		"enterCall",
		"describeCall",
		"createFramePlacer",
		"stackHoldsInstanceCode",
		"setApiValueCheck",
		"setResultAttributor",
		"attributeResult",
		"setHostPrototypeCheck",
		"setHandedOutCheck",
		"setInboundOriginal",
		"handedLeafFunctions",
		"supplierChainCeiling",
		"resolveSupplier",
		"recordInstanceOwner",
		"isInstanceOwnerFile",
		"installViteHostRegistry",
		"installViteLoadedRegistry",
		"setModuleNodeResolver",
		"createModuleLoad",
		"loadOnStack",
		"outerCallerCeiling",
		"frameDefiner",
		"isLeafFileFunction",
		"registerLeafFile",
		"runtime_codeWritersOnStack"
	],
	"#handlers/unified-wrapper": [
		"runtime_frameworkWrite",
		"runtime_unwrapSelfView",
		"runtime_selfModuleReader",
		"runtime_selfModuleCeilings",
		"runtime_selfView",
		"runtime_registerFrameworkMemberCopy",
		"runtime_registerFrameworkMember",
		"runtime_selfFrameworkView",
		"runtime_assertFrameworkRootChange",
		"runtime_selfChangeTarget",
		"runtime_frameworkViewCaller",
		"runtime_selfRootView",
		"runtime_markCallerLocked",
		"runtime_isCallerLocked",
		"runtime_selfHookHandler",
		"settleStandInChanges",
		"releaseStandInChanges",
		"refusedChangeCount",
		"runtime_resolvedAccess",
		"releaseModuleMakers",
		"moduleMakerCount",
		"registerRuntimeSelf",
		"runtime_selfReadAsDefiner",
		"runtime_contextReadAsDefiner",
		"registerRuntimeContext",
		"runtime_contextWritten",
		"runtime_contextRead",
		"runtime_eventPayloadFor",
		"UnifiedWrapper",
		"resolveWrapper",
		"runtime_nodeBehind",
		"IMPL_METADATA_KEYS"
	],
	"#handlers/trusted-root": [
		"genuineWrappers",
		"implWrappers",
		"enforceContextKeyWrite",
		"writersOf",
		"readProtectedContextValue",
		"buildCapturedFlowStore"
	],
	"#handlers/framework-internals": ["markFrameworkInternal", "registerVersionDispatcher", "versionDispatcherRecord", "markSlothletProxy"],
	"#handlers/shared-values": ["recordSharedExports"],
	"#handlers/context-async": ["asyncContextManager"],
	"#handlers/context-live": ["liveContextManager"],
	"#helpers/reserved-keys": ["WRAPPER_INTERNAL_KEYS", "IMPL_METADATA_KEYS"],
	"#helpers/caller-pinning": ["setApiCallerPinner"],
	"#helpers/class-instance-wrapper": [
		"setModuleInstanceCheck",
		"runtime_classInstanceCreator",
		"runtime_wrapClassInstance",
		"runtime_unwrapClassInstance"
	],
	"#helpers/clone-context": ["setCloneViewReader", "setCloneNodeReader", "enableClonePatching", "disableClonePatching"],
	"#helpers/composition": ["setApiNodeCheck"],
	"#helpers/eventemitter-context": [
		"setApiContextChecker",
		"enableEventEmitterPatching",
		"disableEventEmitterPatching",
		"cleanupEventEmitterResources"
	],
	"#helpers/function-source-context": ["setFunctionSourceReader", "enableFunctionSourcePatching", "disableFunctionSourcePatching"],
	"#helpers/promise-context": ["enablePromisePatching", "disablePromisePatching"],
	"#helpers/scheduler-context": ["enableSchedulerPatching", "disableSchedulerPatching"],
	"#helpers/observer-context": ["enableObserverPatching", "disableObserverPatching"],
	"#helpers/eventtarget-context": ["enableEventTargetPatching", "disableEventTargetPatching"],
	"#helpers/eventtarget-property-context": ["enableEventTargetPropertyPatching", "disableEventTargetPropertyPatching"],
	"#helpers/async-resource-context": ["enableAsyncResourcePatching", "disableAsyncResourcePatching"],
	"#helpers/node-callback-context": ["enableNodeCallbackPatching", "disableNodeCallbackPatching"],
	"#processors/typescript": ["sweepStaleFallbackRoots", "releaseSecureFallbackRoot"],
	"@cldmv/slothlet/i18n": ["init"],
	"#i18n": ["setLanguage", "setLanguageAsync", "initI18n"],
	"#factories/context": ["getContextManager", "contextManager", "asyncRuntime", "liveRuntime", "asyncContextManager", "liveContextManager"]
};

/**
 * The ways the api file uses an export besides calling it (see `api/held.mjs`), tried on one function, one class and
 * one object.
 * @type {string[]}
 */
export const SHAPES = ["call", "apply", "bind", "reflect", "map", "then", "eval", "function", "run"];

/**
 * The exports the shapes are tried on.
 * @type {string[]}
 */
export const SHAPE_KEYS = [
	"#handlers/frame-placement:enterCall",
	"#handlers/unified-wrapper:resolveWrapper",
	"#handlers/unified-wrapper:UnifiedWrapper"
];

/**
 * The code an attempt failed with.
 * @param {*} error - What was thrown.
 * @returns {string} The code.
 */
export const codeOf = (error) => error?.code ?? /^\[([A-Z_]+)\]/.exec(String(error?.message))?.[1] ?? error?.name ?? String(error);

/**
 * Import every file of {@link EXPORTS} and leave its exports on `globalThis` for the api file, keyed
 * `<specifier>:<name>`; each file's `internals` too.
 * @returns {Promise<Record<string, *>>} The exports, by key.
 */
export async function holdAll() {
	const held = {};
	for (const [specifier, names] of Object.entries(EXPORTS)) {
		const namespace = await import(specifier);
		for (const name of names) held[`${specifier}:${name}`] = namespace[name];
		if ("internals" in namespace) held[`${specifier}:internals`] = namespace.internals;
	}
	globalThis[KEY] = held;
	return held;
}

/**
 * The host's use of an export: reading a member of it, which every guarded export answers the host.
 * @param {*} value - The export.
 * @returns {string} `"used"`, or the code it failed with.
 */
export function hostUse(value) {
	try {
		void value.name;
		return "used";
	} catch (error) {
		return codeOf(error);
	}
}

/**
 * The api file's use of every held export, and of the shape exports in every shape.
 * @param {object} api - An instance over {@link API_DIR}.
 * @param {Record<string, *>} held - What {@link holdAll} gave.
 * @returns {Promise<Array<{key: string, shape: string, outcome: string}>>} The rows.
 */
export async function collect(api, held) {
	const rows = [];
	for (const key of Object.keys(held)) rows.push({ key, shape: "direct", outcome: await api.held.use(key) });
	for (const key of SHAPE_KEYS) for (const shape of SHAPES) rows.push({ key, shape, outcome: await api.held.use(key, shape) });
	for (const key of SHAPE_KEYS) rows.push({ key, shape: "argument", outcome: await api.held.useArgument(held[key]) });
	return rows;
}
