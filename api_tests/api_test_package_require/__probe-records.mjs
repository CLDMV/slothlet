/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_package_require/__probe-records.mjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794675600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:00:00-08:00 (1794675600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The package-require table under Node's own loader, run in a child process by
 * `tests/vitests/suites/permissions/permissions-require-record-package.test.vitest.mjs`: every api file of `api/` reads
 * the vault through each package it reaches, with nothing denied and with each file's module denied in turn, in eager
 * and lazy mode, in both runtimes and under both attributions. Prints one JSON object keyed
 * `<attribution> <mode>/<runtime>/<denied>/<file>/<package>`.
 * @module api_tests/api_test_package_require/__probe-records
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "api");
const FILES = [
	["first", ["main", "exports", "later"]],
	["second", ["main", "exports", "later"]],
	["third", ["main", "exports"]]
];

const out = {};
for (const attribution of ["precise", "fast"])
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"])
			for (const denied of [null, ...FILES.map(([file]) => file)]) {
				const api = await slothlet({
					base: DIR,
					mode,
					runtime,
					silent: true,
					permissions: {
						defaultPolicy: "allow",
						attribution,
						rules: denied ? [{ caller: `${denied}.**`, target: "vault.**", effect: "deny" }] : []
					}
				});
				for (const [file, packages] of FILES) for (const name of packages) await api[file].bump(name);
				for (const [file, packages] of FILES)
					for (const name of packages) {
						let value;
						try {
							value = await api[file].read(name);
						} catch (error) {
							value = error?.code ?? String(error?.message ?? error);
						}
						out[`${attribution} ${mode}/${runtime}/${denied}/${file}/${name}`] = value;
					}
				await api.shutdown();
			}
process.stdout.write(JSON.stringify(out));
