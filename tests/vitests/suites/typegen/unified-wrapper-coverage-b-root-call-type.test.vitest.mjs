/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typegen/unified-wrapper-coverage-b-root-call-type.test.vitest.mjs
 *	@Date: 2026-11-25T01:46:10-08:00 (1795599970)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:16:37-08:00 (1795601797)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A generated declaration types a function api root's call by the root file's default export.
 *
 * @description
 * Fixture `api_test_uwb_root_inspect`: `root.mjs` (default function, the api root) and `peek.mjs`. The declaration
 * carries a call signature built from `typeof import(".../root.mjs")["default"]`, beside the members.
 *
 * @module tests/vitests/suites/typegen/unified-wrapper-coverage-b-root-call-type
 */

import path from "node:path";
import { rm } from "node:fs/promises";
import { describe, it, expect, afterAll } from "vitest";
import { generate } from "@cldmv/slothlet/typegen";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

const FIXTURE = path.resolve("api_tests/api_test_uwb_root_inspect");

const roots = [];

afterAll(async () => {
	await Promise.allSettled(roots.map((root) => rm(root, { recursive: true, force: true })));
});

describe("function root call type", () => {
	it("types the root's call by its root file's default export", async () => {
		const root = await makeTestTmpDir("uwb-root-call-type");
		roots.push(root);
		const { content } = await generate({ base: FIXTURE, output: path.join(root, "root.d.mts"), name: "RootApi" });
		expect(content).toMatch(/\(\.\.\.args: Parameters<Extract<typeof import\("[^"]*api_test_uwb_root_inspect\/root\.mjs"\)\["default"\]/);
		expect(content).toMatch(/inspectSelf: typeof import\("[^"]*api_test_uwb_root_inspect\/peek\.mjs"\)\["inspectSelf"\]/);
	});
});
