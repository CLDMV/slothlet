/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/provenance-native.test.vitest.mjs
 *	@Date: 2026-05-18T09:38:51-07:00 (1779122331)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:21-07:00 (1791090921)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `permissions.provenance` (#597) under Node's own loader: a module's own function, run by another
 * module's call, runs as the module that wrote it under that call. Inside vitest the leaves load through vite, whose
 * transformed source no file on disk matches, so their code cannot be attributed there and is refused instead; a
 * real Node process is where attribution is shown.
 *
 * @module tests/vitests/suites/permissions/provenance-native
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const ROOT = path.join(process.cwd(), "tmp", "provenance-native");
const PROBE = path.join(ROOT, "probe.mjs");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(ROOT, { recursive: true });
	writeFileSync(
		PROBE,
		[
			'import slothlet from "@cldmv/slothlet";',
			"const out = {};",
			'for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) {',
			"\tconst key = `${mode}/${runtime}`;",
			"\tout[key] = {};",
			"\tfor (const provenance of [true, false]) {",
			"\t\t// lockCaller: a consumer's plain callback, run by the producer.",
			"\t\tconst lock = await slothlet({",
			`\t\t\tbase: ${JSON.stringify(TEST_DIRS.API_TEST_LOCK_CALLER)},`,
			"\t\t\tmode,",
			"\t\t\truntime,",
			"\t\t\tsilent: true,",
			"\t\t\tpermissions: {",
			'\t\t\t\tdefaultPolicy: "allow",',
			"\t\t\t\tprovenance,",
			"\t\t\t\trules: [",
			'\t\t\t\t\t{ caller: "consumer.**", target: "id.consumer", effect: "deny" },',
			'\t\t\t\t\t{ caller: "producer.**", target: "id.producer", effect: "deny" }',
			"\t\t\t\t]",
			"\t\t\t}",
			"\t\t});",
			"\t\tawait lock.producer.relay.setup();",
			"\t\tconst probe = await lock.consumer.probe.makePlainIdentityProbe();",
			"\t\tout[key][`plainCallback/${provenance}`] = await lock.producer.relay.viaDirect(probe);",
			"\t\tawait lock.slothlet.shutdown();",
			"\t\t// lockCaller.caller: the client's job, pinned by the scheduler to itself.",
			"\t\tconst sched = await slothlet({",
			`\t\t\tbase: ${JSON.stringify(TEST_DIRS.API_TEST_LOCK_CALLER_CALLER)},`,
			"\t\t\tmode,",
			"\t\t\truntime,",
			"\t\t\tsilent: true,",
			'\t\t\tpermissions: { defaultPolicy: "allow", provenance, rules: [{ caller: "scheduler.**", target: "slothlet.lockCaller.caller", effect: "allow" }] }',
			"\t\t});",
			"\t\tawait sched.scheduler.service.clear();",
			"\t\tawait sched.client.app.scheduleWhoamiAsService();",
			"\t\tout[key][`pinnedJob/${provenance}`] = (await sched.scheduler.service.fire())[0];",
			"\t\tawait sched.slothlet.shutdown();",
			"\t}",
			"}",
			"console.log(JSON.stringify(out));",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

describe("Permissions > provenance under Node's own loader (#597)", () => {
	it("runs a module's own function as that module inside another module's call when on, as that call when off", () => {
		const result = spawnSync(process.execPath, [PROBE], { cwd: process.cwd(), env: process.env, encoding: "utf8", timeout: 120000 });
		expect(result.status, result.stderr).toBe(0);
		const out = JSON.parse(result.stdout.trim().split("\n").pop());
		expect(Object.keys(out)).toHaveLength(4);
		for (const [config, cases] of Object.entries(out)) {
			expect({ config, ...cases }).toEqual({
				config,
				"plainCallback/true": "consumer",
				"plainCallback/false": "producer",
				"pinnedJob/true": expect.stringMatching(/^client\.app\./),
				"pinnedJob/false": "scheduler.service.everyAsSelf"
			});
		}
	});
});
