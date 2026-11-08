/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_record_leaf/api/ext/b.mjs
 *	@Date: 2026-11-08T12:12:14-08:00 (1794168734)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T14:42:08-08:00 (1794177728)
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
import { load } from "load-pkg";
import { run as runSource } from "write-pkg";
import { open as openOutside } from "../../module-scope/index.mjs";
import { self } from "@cldmv/slothlet/runtime";

/**
 * What {@link prepare} loaded: this module's code that slothlet did not load under the instance's tag.
 * @type {{loaded?: object, written?: object, copy?: object}}
 */
const prepared = {};

/**
 * Open a partition through a package. A copy of this file that `load-pkg` loads (`./b.mjs?copy`) hands its own
 * `viaPkg` to a host leaf (#717).
 * @returns {string} The partition.
 * @example
 * viaPkg(); // "p:ext.b.work"
 */
export const viaPkg = () => packageInvoke(self.store, "partition");

/**
 * Load this module's code that slothlet does not load under the instance's tag, and make the nodes this module creates
 * itself (#717): a file of its own loaded through `load-pkg`, source `write-pkg` writes beside itself and imports, an
 * untagged copy of this file, a node it assigns (`made`) and a leaf it adds as an object (`added`).
 * @returns {Promise<string>} `"prepared"`.
 * @example
 * await api.ext.b.prepare(); // "prepared"
 */
export async function prepare() {
	prepared.loaded = await load(new URL("../../outside/loaded.mjs", import.meta.url));
	prepared.written = await runSource("export function open(store) {\n\treturn store.partition();\n}\n");
	prepared.copy = await load(new URL("./b.mjs?copy", import.meta.url));
	self.made = {
		open(_) {
			return self.store.partition();
		},
		run(fn, _) {
			return fn();
		},
		invoke: packageInvoke
	};
	await self.slothlet.api.add(
		["added"],
		{
			open(_) {
				return self.store.partition();
			},
			run(fn, _) {
				return fn();
			},
			invoke: packageInvoke
		},
		{ moduleID: "ext-added" }
	);
	return "prepared";
}

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
		case "applyCallerPackage":
			return records.apply(options({ via: "callerPackage" }));
		case "applyCallerPackageCalls":
			return records.apply(options({ via: "callerPackageCalls" }));
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
		case "laterDetached":
			// Not awaited: once the leaf resumes after its await, no call awaits it.
			return { pending: records.later(options()) };
		case "hostLoadedByPackage":
			return records.loaded.open(options());
		case "imports":
			return records.run(openOutside.bind(null, self.store), options());
		case "loaded":
			return records.run(prepared.loaded.open.bind(null, self.store), options());
		case "written":
			return records.run(prepared.written.open.bind(null, self.store), options());
		case "copyViaPkg":
			return records.run(prepared.copy.viaPkg, options());
		case "madeOwn":
			return self.made.open(options());
		case "madeRun":
			return self.made.run(packageInvoke.bind(null, self.store, "partition"), options());
		case "madeInvoke":
			return self.made.invoke(self.store, "partition", options());
		case "addedInvoke":
			return self.added.invoke(self.store, "partition", options());
		case "addedOwn":
			return self.added.open(options());
		case "addedRun":
			return self.added.run(packageInvoke.bind(null, self.store, "partition"), options());
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
