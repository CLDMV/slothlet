/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_import_state/api/guest.mjs
 *	@Date: 2026-11-12T23:18:06-08:00 (1794554286)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T23:18:06-08:00 (1794554286)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that imports two helper files and then changes, as far as it can reach it, what slothlet
 * keeps about the files an instance loads: through the process-wide object slothlet shares between its copies, and
 * through the functions of slothlet's own module that keeps the record.
 * @module api_test_import_state.guest
 */
import { fileURLToPath } from "node:url";
import * as esm from "../helpers/reader.mjs";
import cjs from "../helpers/reader.cjs";

const OWN = new URL(import.meta.url);
const INSTANCE = OWN.searchParams.get("slothlet_instance");
const filePath = (relative) => fileURLToPath(new URL(relative, OWN));
const slashPath = (relative) => filePath(relative).replace(/\\/g, "/");
const HELPERS = { esm, cjs };
const TRUSTED = slashPath("./trusted.mjs");

/**
 * The process-wide objects slothlet has shared between its copies, under each name it has used.
 * @returns {object[]} The objects found.
 */
const sharedObjects = () =>
	["@cldmv/slothlet.instanceImportState", "@cldmv/slothlet.instanceImports"].map((name) => globalThis[Symbol.for(name)]).filter(Boolean);

/**
 * Run one attempt, giving back whether it reached anything.
 * @param {Function} attempt - The attempt: returns true when it got hold of something it could change.
 * @returns {Promise<boolean>} Whether it did.
 */
async function reaches(attempt) {
	try {
		return (await attempt()) === true;
	} catch {
		// A refusal reaches nothing.
		return false;
	}
}

/**
 * Slothlet's own module that keeps the record, or null where slothlet refuses this file's import of it (slothlet's
 * own files are slothlet's): the attempts through its functions then reach nothing, and those through the shared
 * object are still made.
 * @returns {Promise<object|null>} The module, or null.
 */
async function recordModule() {
	try {
		return await import("@cldmv/slothlet/helpers/instance-imports");
	} catch {
		return null;
	}
}

/**
 * A record of importers as text, read through whatever it offers a reader.
 * @param {*} graph - The record, or nothing.
 * @returns {string|null} The record, as text, or null for none.
 */
function recordText(graph) {
	if (!graph || typeof graph.keys !== "function") return null;
	const edges = [];
	for (const file of graph.keys()) edges.push([file, [...(graph.get?.(file) ?? [])].sort()]);
	return JSON.stringify(edges.sort());
}

/**
 * What the record says about this instance, as slothlet's own module reports it.
 * @param {object} lib - Slothlet's module that keeps the record.
 * @returns {string} The record, as text.
 */
function snapshot(lib) {
	const graph = lib.instanceImporters(INSTANCE);
	const edges = [];
	for (const file of graph?.keys?.() ?? []) edges.push([file, [...(graph.get(file) ?? [])].sort()]);
	return JSON.stringify({ edges: edges.sort(), files: [...lib.instanceCommonJSFiles(INSTANCE)].sort() });
}

/**
 * Whether this file may import slothlet's own module that keeps the record.
 * @function importable
 * @memberof module:api_test_import_state.guest
 * @returns {Promise<boolean>} True when the import loads.
 * @example
 * await api.guest.importable(); // false
 */
export const importable = async () => (await recordModule()) !== null;

/**
 * Try every way this module has to change what slothlet keeps about the instance's files.
 * @function reach
 * @memberof module:api_test_import_state.guest
 * @returns {Promise<string[]>} The name of each attempt that reached something.
 * @example
 * await api.guest.reach(); // []
 */
export const reach = async () => {
	const reached = [];
	const lib = await recordModule();
	const before = lib === null ? null : snapshot(lib);
	const helperFiles = [slashPath("../helpers/reader.mjs"), slashPath("../helpers/reader.cjs"), filePath("../helpers/reader.cjs")];
	const attempts = {};
	for (const state of sharedObjects()) {
		// The collections of an instance's CommonJS files and private module copies.
		for (const member of ["scopes", "copies", "leaves"]) {
			attempts[`state.${member}`] = () => {
				const held = state[member];
				if (!held || typeof held.get !== "function") return false;
				const own = held.get(INSTANCE);
				for (const file of helperFiles) own?.delete?.(file);
				held.delete(INSTANCE);
				return true;
			};
		}
		// The scope a running require belongs to.
		attempts["state.active"] = () => {
			if (!("active" in state)) return false;
			state.active = { instanceID: INSTANCE, anchor: filePath("./trusted.mjs") };
			return state.active !== null;
		};
		// The entry points of the code slothlet generates.
		for (const member of ["requireCJS", "requireESM", "requireFromModule", "redeem", "claim", "hooks", "recordImports", "own"]) {
			attempts[`state.${member} replaced`] = () => {
				const held = state[member];
				const fake = () => ({ read: esm.read, last: esm.last, reset: esm.reset });
				state[member] = fake;
				return state[member] === fake && held !== fake;
			};
		}
		// The record of which files import a helper.
		attempts["state.graphs"] = () => {
			const importers = [state.graphs?.get?.(INSTANCE), state.imports?.of?.(INSTANCE)];
			const recorded = () => importers.map((graph) => recordText(graph));
			const was = JSON.stringify(recorded());
			let found = false;
			for (const graph of importers) {
				for (const file of helperFiles) {
					const held = graph?.get?.(file);
					if (!held || typeof held.add !== "function") continue;
					held.clear();
					held.add(TRUSTED);
				}
				graph?.clear?.();
				graph?.delete?.(helperFiles[0]);
				found ||= Boolean(graph);
			}
			// Read back through what was found, and through slothlet's module where this file may import it.
			return found && (JSON.stringify(recorded()) !== was || (lib !== null && snapshot(lib) !== before));
		};
		attempts["state.claim"] = () => Boolean(state.claim?.(INSTANCE));
	}
	// The functions of slothlet's own module.
	attempts["instanceImporters"] = () => {
		const graph = lib.instanceImporters(INSTANCE);
		for (const file of helperFiles) {
			const held = graph?.get?.(file);
			held?.clear?.();
			held?.add?.(TRUSTED);
		}
		graph?.delete?.(helperFiles[0]);
		graph?.set?.(helperFiles[0], new Set([TRUSTED]));
		return snapshot(lib) !== before;
	};
	attempts["instanceCommonJSVersion"] = () => {
		const key = lib.instanceCommonJSVersion(INSTANCE)?.key;
		for (const file of helperFiles) key?.delete?.(file);
		key?.clear?.();
		return snapshot(lib) !== before;
	};
	attempts["requireInInstance"] = () => {
		lib.requireInInstance(filePath("../helpers/reader.cjs"), INSTANCE, { fresh: true });
		return true;
	};
	attempts["claimInstanceScope"] = () => Boolean(lib.claimInstanceScope?.(INSTANCE));
	attempts["releaseInstanceScope"] = () => {
		lib.releaseInstanceScope(INSTANCE);
		return snapshot(lib) !== before;
	};
	for (const [name, attempt] of Object.entries(attempts)) if (await reaches(attempt)) reached.push(name);
	return reached;
};

/**
 * Hand a helper's function out inside plain data.
 * @function box
 * @memberof module:api_test_import_state.guest
 * @param {"esm"|"cjs"} kind - Which helper.
 * @returns {{run: Function}} The function, boxed.
 * @example
 * api.guest.box("esm").run();
 */
export const box = (kind) => {
	HELPERS[kind].reset();
	return { run: HELPERS[kind].read };
};

/**
 * Run a helper's function from a timer slothlet does not patch, once this call is over.
 * @function arm
 * @memberof module:api_test_import_state.guest
 * @param {"esm"|"cjs"} kind - Which helper.
 * @returns {Promise<string>} "armed".
 * @example
 * await api.guest.arm("cjs"); // "armed"
 */
export const arm = async (kind) => {
	HELPERS[kind].reset();
	const timers = await import("node:timers");
	timers.setTimeout(HELPERS[kind].read, 20);
	return "armed";
};

/**
 * What a helper's last read gave.
 * @function peek
 * @memberof module:api_test_import_state.guest
 * @param {"esm"|"cjs"} kind - Which helper.
 * @returns {string} The answer.
 * @example
 * api.guest.peek("esm"); // "PERMISSION_DENIED"
 */
export const peek = (kind) => HELPERS[kind].last();

/**
 * Rewrite the record, through slothlet's own module, so that `trusted.mjs` and no longer this file imports the ES
 * module helper.
 * @function relabel
 * @memberof module:api_test_import_state.guest
 * @returns {Promise<boolean>} Whether the record handed out anything to rewrite.
 * @example
 * await api.guest.relabel(); // true
 */
export const relabel = async () => {
	const lib = await recordModule();
	if (lib === null) return false;
	const graph = lib.instanceImporters(INSTANCE);
	const importers = graph?.get?.(slashPath("../helpers/reader.mjs"));
	if (!importers) return false;
	try {
		importers.clear();
		importers.add(TRUSTED);
		graph.edges = (graph.edges ?? 0) + 1;
	} catch {
		// A record that cannot be written stays as it is.
	}
	return true;
};
