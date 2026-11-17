/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /packaging/slothlet-migrate/src/lib/data.mjs
 *	@Date: 2026-11-16T16:03:49-08:00 (1794873829)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:28:24-08:00 (1794875304)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Loads the v3 → v4 tables shipped with the package (data/*.json) and indexes them.
 * @module @cldmv/slothlet-migrate/lib/data
 * @internal
 */

import { readFileSync } from "node:fs";

const dataUrl = new URL("../../data/", import.meta.url);

/**
 * Read one data file.
 * @param {string} name - File name inside data/.
 * @returns {any} Parsed JSON.
 */
function load(name) {
	return JSON.parse(readFileSync(new URL(name, dataUrl), "utf8"));
}

/**
 * @typedef {object} MappingEntry
 * @property {string} id - `kind|old` (or `kind|new` for new names).
 * @property {string} kind - config | option | manifest | export | cli | method | node-field | internal | data | code.
 * @property {string|null} old - v3 name (null for something new in v4).
 * @property {string|null} new - v4 name (null when removed).
 * @property {string} action - rename | move | remove | new | fold | behaviour.
 * @property {string} note - Human-readable note.
 */

const mapping = load("mapping.json");
const extras = load("extras.json");
const codes = load("codes.json");

/** @type {MappingEntry[]} */
export const ENTRIES = [...mapping.entries, ...extras.entries].map((e) => ({ ...e, id: `${e.kind}|${e.old ?? e.new}` }));

for (const [old, nw] of Object.entries(codes.renamed)) {
	ENTRIES.push({ id: `code|${old}`, kind: "code", old, new: nw, action: "rename", note: "Error / warning code renamed." });
}
for (const old of codes.removed) {
	ENTRIES.push({
		id: `code|${old}`,
		kind: "code",
		old,
		new: null,
		action: "remove",
		note: "This code no longer exists in v4; the condition it reported was removed or folded into another check."
	});
}

const byId = new Map(ENTRIES.map((e) => [e.id, e]));

/**
 * Look an entry up by id. Throws when the tables no longer carry it, so a renamed or dropped
 * row breaks the tests instead of silently disabling a rewrite.
 * @param {string} id - `kind|old`.
 * @returns {MappingEntry} The entry.
 */
export function entry(id) {
	const found = byId.get(id);
	if (!found) throw new Error(`slothlet-migrate: mapping entry "${id}" is missing from data/`);
	return found;
}

/** Renamed error / warning codes: old → new. */
export const CODE_RENAMES = new Map(Object.entries(codes.renamed));
/** Codes that no longer exist. */
export const CODE_REMOVED = new Set(codes.removed);
/** Every code string that is slothlet's, in either version (used to prove a value is a slothlet error). */
export const KNOWN_CODES = new Set([...Object.keys(codes.renamed), ...Object.values(codes.renamed), ...codes.removed, ...codes.kept]);

/**
 * Method rows keyed by their path below `api.slothlet.` (rule targets drop the `api.` prefix).
 * @type {Map<string, MappingEntry>}
 */
export const METHODS = new Map();
for (const e of ENTRIES) {
	if (e.kind === "method" && e.old && e.old.startsWith("api.slothlet.")) METHODS.set(e.old.slice("api.slothlet.".length), e);
}

/**
 * Export rows split into whole-specifier moves and named-export changes.
 */
export const EXPORTS = { specifiers: new Map(), names: new Map() };
for (const e of ENTRIES) {
	if (e.kind !== "export" || !e.old) continue;
	if (e.old.includes("(")) continue; // option rows inside an export (handled as option keys)
	if (e.old.includes("#")) EXPORTS.names.set(e.old, e);
	else EXPORTS.specifiers.set(e.old, e);
}

export const SOURCES = { mapping: mapping.source, extras: extras.source, codes: codes.source };
