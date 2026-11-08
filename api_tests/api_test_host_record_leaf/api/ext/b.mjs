/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_record_leaf/api/ext/b.mjs
 *	@Date: 2026-11-08T12:12:14-08:00 (1794168734)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T12:29:59-08:00 (1794169799)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The calling module of the host record leaf tests (#717): `work` calls one of the host's record leaves
 * the way the table in docs/PERMISSIONS.md's #717 rule lists, with a mutable or a frozen argument, and reports what the
 * store partition gave or the code and caller it was refused with.
 * @module api_tests/api_test_host_record_leaf/ext/b
 */

import vm from "node:vm";
import { invoke as packageInvoke } from "ext-pkg";
import { self } from "@cldmv/slothlet/runtime";

/**
 * The argument a call is handed: `base` as it is, or frozen.
 * @param {object} base - The argument.
 * @param {"mutable"|"frozen"} kind - Which.
 * @returns {object} The argument.
 */
function argument(base, kind) {
	return kind === "frozen" ? Object.freeze(base) : base;
}

/**
 * Make the call a row names.
 * @param {object} records - The host's record leaves, as this module reaches them.
 * @param {string} row - The row.
 * @param {"mutable"|"frozen"} kind - The argument's kind.
 * @param {{invoke?: Function}} tools - Functions of the host's the host handed this module.
 * @returns {unknown} What the leaf gave.
 */
function call(records, row, kind, tools) {
	const options = (extra = {}) => argument({ id: "x", ...extra }, kind);
	switch (row) {
		case "apply":
			return records.apply(options());
		case "query":
			return records.query(options());
		case "applyFile":
			return records.apply(options({ via: "file" }));
		case "applyPackage":
			return records.apply(options({ via: "package" }));
		case "applyPackageCalls":
			return records.apply(options({ via: "packageCalls" }));
		case "applyOtherPackage":
			return records.apply(options({ via: "otherPackage" }));
		case "applyOtherPackageCalls":
			return records.apply(options({ via: "otherPackageCalls" }));
		case "callback":
			return records.run(() => self.store.partition(), options());
		case "getter":
			return records.use(
				argument(
					{
						get id() {
							return self.store.partition();
						}
					},
					kind
				)
			);
		case "toString":
			return records.convert(
				argument(
					{
						toString() {
							return self.store.partition();
						}
					},
					kind
				)
			);
		case "proxy":
			return records.use(new Proxy(argument({}, kind), { get: () => self.store.partition() }));
		case "thenable":
			return records.settle(
				argument(
					{
						then(resolve, reject) {
							try {
								resolve(self.store.partition());
							} catch (error) {
								reject(error);
							}
						}
					},
					kind
				)
			);
		case "newFunction":
			return records.run(new Function("s", "return s.store.partition();").bind(null, self), options());
		case "eval":
			return records.run((0, eval)("(s) => s.store.partition()").bind(null, self), options());
		case "vm":
			return records.run(vm.runInThisContext("(s) => s.store.partition()").bind(null, self), options());
		case "package":
			return records.run(packageInvoke.bind(null, self.store, "partition"), options());
		case "hostFunction":
			return records.run(tools.invoke.bind(null, self.store, "partition"), options());
		case "later":
			return records.later(options());
		default:
			throw new Error(`unknown row ${row}`);
	}
}

/**
 * Call one of the host's record leaves as a row of the table names.
 * @param {string} mount - Where the record leaves are mounted, dotted (`host.records` or `records.host`).
 * @param {string} row - The row.
 * @param {"mutable"|"frozen"} kind - The argument's kind.
 * @param {{invoke?: Function}} [tools={}] - Functions of the host's the host hands this module.
 * @returns {Promise<{ok: true, value: unknown}|{ok: false, code: string, caller: string|null}>} The outcome.
 * @example
 * await api.ext.b.work("host.records", "apply", "mutable"); // { ok: true, value: "p:host.records.apply" }
 */
export async function work(mount, row, kind, tools = {}) {
	const records = mount.split(".").reduce((node, key) => node[key], self);
	try {
		return { ok: true, value: await call(records, row, kind, tools) };
	} catch (error) {
		return { ok: false, code: error?.code ?? String(error), caller: error?.context?.caller ?? null };
	}
}
