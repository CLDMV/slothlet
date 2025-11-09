/**
 * @Project: @cldmv/slothlet
 * @Filename: /src/lib/runtime/runtime.mjs
 * @Author: Nate Hyson <CLDMV>
 * @Email: <Shinrai@users.noreply.github.com>
 * @Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Simple runtime dispatcher - directly re-exports from selected runtime.
 * @module @cldmv/slothlet/runtime
 * @public
 */

// Import both runtime implementations
import * as alsRuntime from "./runtime-asynclocalstorage.mjs";
import * as liveBindingsRuntime from "./runtime-livebindings.mjs";

// Global runtime type setting from slothlet.mjs
let activeRuntimeType = "asynclocalstorage";

/**
 * Set the active runtime type.
 * @param {string} runtimeType - Either "asynclocalstorage" or "livebindings"
 * @package
 */
export function setActiveRuntimeType(runtimeType) {
	activeRuntimeType = runtimeType;
}

/**
 * Get the current runtime implementation.
 * @returns {object} The active runtime module
 * @internal
 */
function getCurrentRuntime() {
	return activeRuntimeType === "livebindings" ? liveBindingsRuntime : alsRuntime;
}

// Re-export all functions from both runtimes
export const { runWithCtx, makeWrapper, getCtx } = {
	runWithCtx: (...args) => getCurrentRuntime().runWithCtx(...args),
	makeWrapper: (...args) => getCurrentRuntime().makeWrapper(...args),
	getCtx: (...args) => (getCurrentRuntime().getCtx ? getCurrentRuntime().getCtx(...args) : null)
};

// Re-export live bindings from both runtimes
export const self = getCurrentRuntime().self;
export const context = getCurrentRuntime().context;
export const reference = getCurrentRuntime().reference;

// Re-export optional exports (live bindings runtime only)
export const instanceId = getCurrentRuntime().instanceId || "asynclocalstorage-runtime";
export const sharedALS = getCurrentRuntime().sharedALS;
