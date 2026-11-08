/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_record_leaf/probe-records.mjs
 *	@Date: 2026-11-08T12:17:57-08:00 (1794169077)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T12:30:00-08:00 (1794169800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The #717 host record leaf table under Node's own loader, run in a child process by
 * `tests/vitests/suites/permissions/permissions-host-record-leaf.test.vitest.mjs`: the host's record leaves of
 * `host/records.mjs`, mounted at `host.records` and at `records.host`, called by `ext.b.work` for every row with a mutable
 * and a frozen argument, in eager and lazy mode and in both runtimes. Prints one JSON object keyed
 * `<mode>/<runtime>/<mount>/<row>/<kind>`.
 * @module api_tests/api_test_host_record_leaf/probe-records
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { makeRecords, invoke } from "./host/records.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const RULES = [
	{ caller: "ext.b.**", target: "host.records.**", effect: "allow" },
	{ caller: "host.records.**", target: "store.**", effect: "allow" },
	{ caller: "ext.b.**", target: "records.host.**", effect: "allow" },
	{ caller: "records.host.**", target: "store.**", effect: "allow" }
];

const ROWS = [
	"apply",
	"query",
	"applyFile",
	"applyPackage",
	"applyPackageCalls",
	"applyOtherPackage",
	"applyOtherPackageCalls",
	"applyCallerPackage",
	"applyCallerPackageCalls",
	"callback",
	"getter",
	"toString",
	"proxy",
	"thenable",
	"newFunction",
	"eval",
	"vm",
	"package",
	"hostFunction",
	"later"
];

const out = {};
for (const mode of ["eager", "lazy"]) {
	for (const runtime of ["async", "live"]) {
		for (const mount of ["host.records", "records.host"]) {
			const api = await slothlet({
				base: path.join(HERE, "api"),
				mode,
				runtime,
				silent: true,
				permissions: { defaultPolicy: "deny", rules: RULES }
			});
			await api.slothlet.api.add(
				mount.split("."),
				makeRecords(() => api),
				{ moduleID: "host-records" }
			);
			for (const row of ROWS)
				for (const kind of ["mutable", "frozen"])
					out[`${mode}/${runtime}/${mount}/${row}/${kind}`] = await api.ext.b.work(mount, row, kind, { invoke });
			await api.slothlet.shutdown();
		}
	}
}
process.stdout.write(JSON.stringify(out));
