/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_body_mutable_arg/api/project.mjs
 *	@Date: 2026-11-07T21:44:01-08:00 (1794116641)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T12:30:12-08:00 (1794169812)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The calling module of the leaf-body tests (#717): `hand` calls one of the host's leaves with a value
 * built as `kind` names, the way rummage's extensions call `self.host.*` with an options object; `own` is a leaf of this
 * module whose body reads the vault, called by the `other` module with plain data that can still be changed.
 * @module api_tests/api_test_leaf_body_mutable_arg/project
 */

import vm from "node:vm";
import { self } from "@cldmv/slothlet/runtime";

/**
 * Build the value a call is handed.
 * @param {string} kind - What to hand.
 * @param {string} filename - The host file the planted code names.
 * @returns {unknown} The value.
 */
function valueOf(kind, filename) {
	switch (kind) {
		case "mutable":
			return { id: "x" };
		case "frozen":
			return Object.freeze({ id: "x" });
		case "nested":
			return { options: { id: "x" }, list: [1, 2] };
		case "callback":
			return () => self.vault.get();
		case "callbackOpen":
			return () => self.vault.open();
		case "callbackWho":
			return () => self.vault.whoami();
		case "getter":
			return {
				get id() {
					return self.vault.get();
				}
			};
		case "toString":
			return {
				toString() {
					return self.vault.get();
				}
			};
		case "proxy":
			return new Proxy({}, { get: () => self.vault.get() });
		case "vm":
			return vm.compileFunction("return s.vault.get();", ["s"], { filename }).bind(null, self);
		case "vmScript":
			return new vm.Script("(s) => s.vault.get()", { filename }).runInThisContext().bind(null, self);
		case "sourceURL":
			return new Function("s", `return s.vault.get();\n//# sourceURL=${filename}`).bind(null, self);
		default:
			throw new Error(`unknown kind ${kind}`);
	}
}

/**
 * Call one of the host's leaves with a value of the given kind.
 * @param {string} mount - The host mount under `host` (`access`, `inline`).
 * @param {string} leaf - The leaf's name.
 * @param {string} kind - What to hand it.
 * @param {string} [filename] - The host file planted code names.
 * @returns {Promise<unknown>} What the host's leaf gave.
 * @example
 * await api.project.hand("access", "register", "mutable"); // "secret"
 */
export async function hand(mount, leaf, kind, filename = "") {
	const leaves = mountOf(mount);
	return leaves[leaf](valueOf(kind, filename));
}

/**
 * The leaves of a host mount under `host` (`access`, `inline`).
 * @param {string} mount - The mount.
 * @returns {object} Its leaves.
 */
function mountOf(mount) {
	return mount.split(".").reduce((node, key) => node[key], self.host);
}

/**
 * A leaf of this module whose own body reads what the module may read.
 * @param {object} arg - Plain data.
 * @returns {{who: string|null, open: string, id: unknown}} The vault's answers.
 * @example
 * await api.project.own({ id: "x" }); // { who: "project.own", open: "open", id: "x" }
 */
export function own(arg) {
	return { who: self.vault.whoami(), open: self.vault.open(), id: arg.id };
}
