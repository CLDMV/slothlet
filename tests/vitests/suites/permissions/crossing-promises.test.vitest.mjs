/**
 * @fileoverview A promise one module holds in data behaves for another module as it does in plain JavaScript.
 *
 * @description
 * A module reads a promise out of data another module handed it and does what ordinary code does with one: nothing,
 * a `catch`, a `then` with no `catch`, an `await`. The other module then rejects the promise. Each case runs in a
 * process of its own, once with the two modules imported as plain modules and once through slothlet with the
 * permission system on, and the two must agree on what the handlers saw and on which rejections the process reported
 * as unhandled: none where the owner handled its promise and the reader only held it, and the owner's own where nobody
 * handled it.
 * @module tests/vitests/suites/permissions/crossing-promises
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const PROBE = resolve("api_tests/api_test_crossing_rules/promise-probe.mjs");

/**
 * Run one case in a process of its own.
 * @param {"plain"|"precise"|"fast"} kind - Plain modules, or slothlet with that attribution.
 * @param {"async"|"live"} runtime - The runtime.
 * @param {string} name - The case.
 * @returns {{shape: string, outcome: string, reported: string[]}} What the process printed.
 */
function run(kind, runtime, name) {
	const out = execFileSync(process.execPath, ["--conditions=slothlet-dev", PROBE, kind, runtime, name], { encoding: "utf8" });
	return JSON.parse(out.trim().split("\n").pop());
}

/** What plain JavaScript gives for each case, stated here so a twin that misbehaved cannot pass for the expected value. */
const PLAIN = {
	ignoredHandled: { shape: "true,function,[object Promise]", outcome: "nothing,no wait", reported: [] },
	ignoredUnhandled: { shape: "true,function,[object Promise]", outcome: "nothing,no wait", reported: ["boom"] },
	caught: { shape: "true,function,[object Promise]", outcome: "boom,no wait", reported: [] },
	chainedWithoutCatch: { shape: "true,function,[object Promise]", outcome: "nothing,no wait", reported: ["boom"] },
	awaited: { shape: "true,function,[object Promise]", outcome: "nothing,boom", reported: [] }
};

describe.each(Object.keys(PLAIN))("a promise another module holds in data > %s", (name) => {
	it("is what the plain modules give", () => {
		expect(run("plain", "async", name)).toEqual(PLAIN[name]);
	});

	it.each([
		["precise", "async"],
		["precise", "live"],
		["fast", "async"],
		["fast", "live"]
	])("is the same through slothlet (%s, %s)", (kind, runtime) => {
		expect(run(kind, runtime, name)).toEqual(PLAIN[name]);
	});
});
