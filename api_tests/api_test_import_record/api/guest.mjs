/**
 * @fileoverview Fixture: a module that imports a helper file and then rewrites, as far as it can reach it, the
 * process-wide record of which file imports which.
 * @module api_test_import_record.guest
 * @memberof module:api_test_import_record
 */
import { fileURLToPath } from "node:url";
import { read, last, reset } from "../helpers/reader.mjs";

const OWN = new URL(import.meta.url);
const INSTANCE = OWN.searchParams.get("slothlet_instance");
const slashPath = (relative) => fileURLToPath(new URL(relative, OWN)).replace(/\\/g, "/");
const HELPER = slashPath("../helpers/reader.mjs");
const TAGGED = slashPath("../helpers/tagged.mjs");
const TRUSTED = slashPath("./trusted.mjs");

/** @type {{last: function(): string}|null} The copy of `tagged.mjs` this file loaded. */
let tagged = null;

/**
 * Every collection of importers of a file this module can get hold of through the process-wide state.
 * @param {string} file - The imported file.
 * @returns {Array<Set<string>>} The collections.
 */
function reachable(file) {
	const state = globalThis[Symbol.for("@cldmv/slothlet.instanceImportState")];
	const found = [];
	for (const graph of [state?.graphs?.get?.(INSTANCE), state?.imports?.of?.(INSTANCE)]) {
		const importers = graph?.get?.(file);
		if (importers && typeof importers.add === "function") found.push(importers);
	}
	return found;
}

/**
 * Rewrite the record so that `trusted.mjs`, and no longer this file, imports the helper.
 * @function rewrite
 * @memberof module:api_test_import_record.guest
 * @returns {number} How many collections were reached.
 * @example
 * api.guest.rewrite(); // 0
 */
export const rewrite = () => {
	const found = reachable(HELPER);
	for (const importers of found) {
		importers.clear();
		importers.add(TRUSTED);
	}
	return found.length;
};

/**
 * Record, through the function the state offers, that `trusted.mjs` imports the helper files.
 * @function claim
 * @memberof module:api_test_import_record.guest
 * @returns {boolean} Whether the state offered the function.
 * @example
 * api.guest.claim(); // true
 */
export const claim = () => {
	const state = globalThis[Symbol.for("@cldmv/slothlet.instanceImportState")];
	if (typeof state?.recordImports !== "function") return false;
	state.recordImports(INSTANCE, TRUSTED, [HELPER, TAGGED]);
	return true;
};

/**
 * Hand the helper's function out inside plain data.
 * @function box
 * @memberof module:api_test_import_record.guest
 * @returns {{run: Function}} The function, boxed.
 * @example
 * api.guest.box().run();
 */
export const box = () => {
	reset();
	return { run: read };
};

/**
 * Run the helper's function from a timer slothlet does not patch, once this call is over.
 * @function arm
 * @memberof module:api_test_import_record.guest
 * @returns {Promise<string>} "armed".
 * @example
 * await api.guest.arm(); // "armed"
 */
export const arm = async () => {
	reset();
	const timers = await import("node:timers");
	timers.setTimeout(read, 20);
	return "armed";
};

/**
 * What the helper's last read gave.
 * @function peek
 * @memberof module:api_test_import_record.guest
 * @returns {string} The answer.
 * @example
 * api.guest.peek(); // "PERMISSION_DENIED"
 */
export const peek = () => last();

/**
 * Load `tagged.mjs` under a URL that says it was loaded for `trusted.mjs`, and hand its function out inside plain data.
 * @function boxTagged
 * @memberof module:api_test_import_record.guest
 * @returns {Promise<{run: Function}>} The function, boxed.
 * @example
 * (await api.guest.boxTagged()).run();
 */
export const boxTagged = async () => {
	const target = new URL("../helpers/tagged.mjs", OWN);
	target.searchParams.set("slothlet_instance", INSTANCE);
	target.searchParams.set("slothlet_helpers", "module");
	target.searchParams.set("slothlet_for", TRUSTED);
	tagged = await import(target.href);
	return { run: tagged.read };
};

/**
 * What the tagged helper's last read gave.
 * @function peekTagged
 * @memberof module:api_test_import_record.guest
 * @returns {string} The answer.
 * @example
 * api.guest.peekTagged(); // "PERMISSION_DENIED"
 */
export const peekTagged = () => tagged?.last() ?? "nothing";
