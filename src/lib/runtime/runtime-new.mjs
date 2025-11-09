/**
 * @Project: @cldmv/slothlet
 * @Filename: /src/lib/runtime/runtime.mjs
 * @Author: Nate Hyson <CLDMV>
 * @Email: <Shinrai@users.noreply.github.com>
 * @Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Minimal runtime dispatcher that directly delegates to active runtime.
 * @module @cldmv/slothlet/runtime
 * @public
 */

// Import both runtime implementations
import * as alsRuntime from "./runtime-asynclocalstorage.mjs";
import * as liveBindingsRuntime from "./runtime-livebindings.mjs";

// Global runtime type setting
let activeRuntimeType = "asynclocalstorage";

export function setActiveRuntimeType(runtimeType) {
	activeRuntimeType = runtimeType;
}

function getCurrentRuntime() {
	return activeRuntimeType === "livebindings" ? liveBindingsRuntime : alsRuntime;
}

// Function exports - these can be dynamic
export function runWithCtx(ctx, fn, thisArg, args) {
	return getCurrentRuntime().runWithCtx(ctx, fn, thisArg, args);
}

export function makeWrapper(ctx) {
	return getCurrentRuntime().makeWrapper(ctx);
}

export function getCtx() {
	const runtime = getCurrentRuntime();
	return runtime.getCtx ? runtime.getCtx() : null;
}

// Simple object delegation for live bindings - no complex proxy handlers
export const self = getCurrentRuntime().self;
export const context = getCurrentRuntime().context;
export const reference = getCurrentRuntime().reference;
export const instanceId = getCurrentRuntime().instanceId || "asynclocalstorage-runtime";
export const sharedALS = getCurrentRuntime().sharedALS;
