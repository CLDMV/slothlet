/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permission_levels/peer/probe.mjs
 *	@Date: 2026-11-18T09:00:00-08:00 (1795021200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T09:00:00-08:00 (1795021200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A second module, its own file, that calls, reads and writes other modules' members by path, adds rules and mounts modules,
 * reporting each outcome.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a step and report its outcome.
 * @param {function(): *} step - The step.
 * @returns {*} The step's result, or the code of the error it was refused with.
 * @example
 * attempt(() => "done"); // "done"
 */
function attempt(step) {
	try {
		return step();
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * The node `self` holds at a dotted path.
 * @param {string[]} parts - The path's segments.
 * @returns {*} What is there.
 * @example
 * at(["cache"]);
 */
function at(parts) {
	let node = self;
	for (const part of parts) node = node[part];
	return node;
}

/**
 * Read a member.
 * @param {string} path - Its dotted api path.
 * @returns {*} Its value, or the refusal's code.
 * @example
 * read("cache.key"); // 1
 */
export function read(path) {
	return attempt(() => at(path.split(".")));
}

/**
 * Call a function member.
 * @param {string} path - Its dotted api path.
 * @returns {*} What it returned, or the refusal's code.
 * @example
 * call("cache.fn"); // "fn"
 */
export function call(path) {
	return attempt(() => at(path.split("."))());
}

/**
 * Assign a member.
 * @param {string} path - Its dotted api path.
 * @param {*} value - The value assigned.
 * @returns {string} `"done"`, or the refusal's code.
 * @example
 * write("cache.key", 5); // "done"
 */
export function write(path, value) {
	return attempt(() => {
		const parts = path.split(".");
		at(parts.slice(0, -1))[parts[parts.length - 1]] = value;
		return "done";
	});
}

/**
 * Add a permission rule.
 * @param {object} rule - The rule.
 * @returns {string} `"done"`, or the refusal's code.
 * @example
 * addRule({ caller: "**", target: "guest.**:full", effect: "allow" }); // "done"
 */
export function addRule(rule) {
	return attempt(() => {
		self.slothlet.permissions.rules.add(rule);
		return "done";
	});
}

/**
 * Mount a module.
 * @param {string} path - The mount path.
 * @param {string} dir - The module's folder.
 * @returns {Promise<string>} `"done"`, or the refusal's code.
 * @example
 * await mount("cache.extra", dir); // "done"
 */
export async function mount(path, dir) {
	try {
		await self.slothlet.api.add(path, dir);
		return "done";
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * List a node's keys, sorted.
 * @param {string} path - Its dotted api path.
 * @returns {string[]|string} The keys, or the refusal's code.
 * @example
 * keys("box"); // ["computed", "plain"]
 */
export function keys(path) {
	return attempt(() => Object.keys(at(path.split("."))).sort());
}
