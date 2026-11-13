/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_record_leaf/__probe-records.mjs
 *	@Date: 2026-11-08T12:17:57-08:00 (1794169077)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T14:42:10-08:00 (1794177730)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The #717 host record leaf table under Node's own loader, run in a child process by
 * `tests/vitests/suites/permissions/permissions-host-record-leaf.test.vitest.mjs`: the host's record leaves of
 * `host/records.mjs`, mounted at `host.records` and at `records.host`, called by `ext.b.work` for every row with a mutable
 * and a frozen argument, in eager and lazy mode and in both runtimes, after `ext.b.prepare` loaded its own code slothlet
 * does not tag and made its own nodes. Prints one JSON object keyed
 * `<mode>/<runtime>/<mount>/<row>/<kind>`.
 * @module api_tests/api_test_host_record_leaf/__probe-records
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { load } from "load-pkg";
import { makeRecords, invoke } from "./host/records.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const RULES = [
	{ caller: "ext.b.**", target: "host.records.**", effect: "allow" },
	{ caller: "host.records.**", target: "store.**", effect: "allow" },
	{ caller: "ext.b.**", target: "records.host.**", effect: "allow" },
	{ caller: "records.host.**", target: "store.**", effect: "allow" },
	// The nodes ext.b makes itself (`made`, assigned, and `added`, its own `api.add`).
	{ caller: "ext.b.**", target: "slothlet.api.**", effect: "allow" },
	{ caller: "ext.b.**", target: "made:write", effect: "allow" },
	{ caller: "ext.b.**", target: "made.**:write", effect: "allow" },
	{ caller: "ext.b.**", target: "added:write", effect: "allow" },
	{ caller: "ext.b.**", target: "added.**:write", effect: "allow" },
	{ caller: "ext.b.**", target: "made.**", effect: "allow" },
	{ caller: "made.**", target: "store.**", effect: "allow" },
	{ caller: "ext.b.**", target: "added.**", effect: "allow" },
	{ caller: "added.**", target: "store.**", effect: "allow" }
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
	"imports",
	"loaded",
	"copyViaPkg",
	"written",
	"later",
	"laterDetached",
	"hostLoadedByPackage",
	"madeOwn",
	"madeInvoke",
	"madeRun",
	"addedOwn",
	"addedInvoke",
	"addedRun"
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
			// A leaf whose host file the host loaded through a package ext.b imports too.
			const loadedByPackage = await load(new URL("./host/loaded-by-package.mjs", import.meta.url));
			await api.slothlet.api.add(
				[...mount.split("."), "loaded"],
				{
					open(_) {
						return loadedByPackage.open(api.store);
					}
				},
				{ moduleID: "host-loaded" }
			);
			await api.ext.b.prepare();
			for (const row of ROWS)
				for (const kind of ["mutable", "frozen"]) {
					let outcome = await api.ext.b.work(mount, row, kind, { invoke });
					// Settled here, by the host, once ext.b.work has returned: no call awaits the leaf.
					if (row === "laterDetached" && outcome.ok) outcome = { ok: true, value: await outcome.value.pending };
					out[`${mode}/${runtime}/${mount}/${row}/${kind}`] = outcome;
				}
			await api.slothlet.shutdown();
		}
	}
}
process.stdout.write(JSON.stringify(out));
