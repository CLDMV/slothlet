/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-host-owner-record.test.vitest.mjs
 *	@Date: 2026-11-05T17:08:15-08:00 (1793927295)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-05T17:14:22-08:00 (1793927662)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Which package created an instance, as `slothlet()` records it (#714): the package of the code that
 * called it, and only that package's own files.
 * @description
 * `recordInstanceOwner` reads the stack when an instance is created; `isInstanceOwnerFile` answers whether a file
 * belongs to the package it recorded. A file of a package installed inside the owner's folder has its own
 * `package.json` and is not the owner's. Code compiled at run time names no package, and a file no `package.json`
 * sits above belongs to no package.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { isInstanceOwnerFile, recordInstanceOwner } from "#handlers/frame-placement";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../../../..").replaceAll("\\", "/");
const FIXTURE = `${ROOT}/api_tests/api_test_host_owner_code`;

describe("Permissions > the package that created an instance (#714)", () => {
	it("records the package of the code creating the instance", () => {
		const instance = {};
		recordInstanceOwner(instance);
		expect(isInstanceOwnerFile(instance, `${ROOT}/tests/vitests/suites/permissions/other.mjs`)).toBe(true);
		expect(isInstanceOwnerFile(instance, `${FIXTURE}/probe.mjs`)).toBe(true);
	});

	it("does not count a package installed inside the owner's folder", () => {
		const instance = {};
		recordInstanceOwner(instance);
		expect(isInstanceOwnerFile(instance, `${FIXTURE}/node_modules/owner-host/context.mjs`)).toBe(false);
		expect(isInstanceOwnerFile(instance, `${FIXTURE}/node_modules/stranger-pkg/index.mjs`)).toBe(false);
	});

	it("records no owner for an instance nothing recorded", () => {
		expect(isInstanceOwnerFile({}, `${ROOT}/tests/vitests/suites/permissions/other.mjs`)).toBe(false);
	});

	it("records no owner when the creating code was compiled at run time", () => {
		const instance = {};
		(0, eval)("(record, target) => record(target)")(recordInstanceOwner, instance);
		expect(isInstanceOwnerFile(instance, `${ROOT}/tests/vitests/suites/permissions/other.mjs`)).toBe(false);
	});

	it("records no owner when no package.json sits above the creating file", () => {
		const instance = {};
		vm.runInThisContext("(record, target) => record(target)", { filename: "/slothlet-i714-nowhere/host.mjs" })(
			recordInstanceOwner,
			instance
		);
		expect(isInstanceOwnerFile(instance, "/slothlet-i714-nowhere/other.mjs")).toBe(false);
	});

	it("keeps answering past the size its cache of package roots is held to", () => {
		const instance = {};
		recordInstanceOwner(instance);
		for (let i = 0; i < 4100; i++) expect(isInstanceOwnerFile(instance, `/slothlet-i714-nowhere/f${i}.mjs`)).toBe(false);
		expect(isInstanceOwnerFile(instance, `${ROOT}/tests/vitests/suites/permissions/other.mjs`)).toBe(true);
	});
});
