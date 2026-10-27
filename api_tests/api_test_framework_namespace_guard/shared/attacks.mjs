/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_framework_namespace_guard/shared/attacks.mjs
 *	@Date: 2026-10-18T15:34:55-07:00 (1792362895)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T19:50:38-07:00 (1792378238)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Changes a module tries to make to the framework namespace `self.slothlet` (#625), shared by
 * the `base` and `guest` fixtures so the same code runs as the base module and as a module mounted with
 * `api.add`. Each attack reports what happened instead of throwing, so one call can try several.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a change and report its outcome.
 * @param {function(): *} change - The change.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * attempt(() => { self.slothlet.bind = null; }); // "LOOSE_SET_NOT_OWNED"
 */
function attempt(change) {
	try {
		change();
		return "done";
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * Replace, define, and delete a member of `self.slothlet`.
 * @param {string} name - Member of the namespace.
 * @returns {{assign: string, define: string, remove: string}} Outcome of each change.
 * @example
 * changeMember("lockCaller");
 */
export function changeMember(name) {
	return {
		assign: attempt(() => {
			self.slothlet[name] = function fake() {
				return "FAKE";
			};
		}),
		define: attempt(() => {
			Object.defineProperty(self.slothlet, name, { value: "FAKE", configurable: true, writable: true, enumerable: true });
		}),
		remove: attempt(() => {
			delete self.slothlet[name];
		})
	};
}

/**
 * Change `self.slothlet` itself: replace it, define it, delete it, swap its prototype, freeze, seal, or
 * close it to extension.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeNamespace();
 */
export function changeNamespace() {
	return {
		assign: attempt(() => {
			self.slothlet = {};
		}),
		define: attempt(() => {
			Object.defineProperty(self, "slothlet", { value: {}, configurable: true, writable: true, enumerable: true });
		}),
		remove: attempt(() => {
			if (!delete self.slothlet) throw new Error("NOT_DELETED");
		}),
		setPrototypeOf: attempt(() => {
			Object.setPrototypeOf(self.slothlet, null);
		}),
		preventExtensions: attempt(() => {
			Object.preventExtensions(self.slothlet);
		}),
		freeze: attempt(() => {
			Object.freeze(self.slothlet);
		}),
		seal: attempt(() => {
			Object.seal(self.slothlet);
		})
	};
}

/**
 * Change members deeper under the namespace.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeNested();
 */
export function changeNested() {
	return {
		lockCallerCallerDefine: attempt(() => {
			Object.defineProperty(self.slothlet.lockCaller, "caller", { value: () => "FAKE", configurable: true, writable: true });
		}),
		lockCallerCallerDelete: attempt(() => {
			delete self.slothlet.lockCaller.caller;
		}),
		permissionsMember: attempt(() => {
			self.slothlet.permissions.addRule = () => "FAKE";
		}),
		permissionsPlant: attempt(() => {
			self.slothlet.permissions.planted = 1;
		}),
		hookOn: attempt(() => {
			self.slothlet.hook.on = () => "FAKE";
		}),
		hookFreeze: attempt(() => {
			Object.freeze(self.slothlet.hook);
		}),
		apiAdd: attempt(() => {
			self.slothlet.api.add = () => "FAKE";
		}),
		metadataProto: attempt(() => {
			Object.setPrototypeOf(self.slothlet.metadata, null);
		}),
		materializeGetPlant: attempt(() => {
			self.slothlet.materialize.get.planted = 1;
		}),
		materializeGetProto: attempt(() => {
			Object.setPrototypeOf(self.slothlet.materialize.get, null);
		}),
		materializeWaitPlant: attempt(() => {
			self.slothlet.materialize.wait.planted = 1;
		}),
		materializedGetterPlant: attempt(() => {
			Object.getOwnPropertyDescriptor(self.slothlet.materialize, "materialized").get.planted = 1;
		}),
		permissionsSymbol: attempt(() => {
			self.slothlet.permissions[Symbol.for("slothlet.test.i625.namespace")] = 1;
		}),
		permissionsSymbolDefine: attempt(() => {
			Object.defineProperty(self.slothlet.permissions, Symbol.for("slothlet.test.i625.namespace"), { value: 1, configurable: true });
		}),
		hookSymbolDelete: attempt(() => {
			delete self.slothlet.hook[Symbol.for("slothlet.test.i625.namespace")];
		})
	};
}

/**
 * Change the framework's root functions `self.shutdown` and `self.destroy`.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeRootFunctions();
 */
export function changeRootFunctions() {
	return {
		shutdownAssign: attempt(() => {
			self.shutdown = () => "FAKE";
		}),
		shutdownDelete: attempt(() => {
			if (!delete self.shutdown) throw new Error("NOT_DELETED");
		}),
		shutdownMember: attempt(() => {
			self.shutdown.planted = 1;
		}),
		destroyAssign: attempt(() => {
			self.destroy = () => "FAKE";
		}),
		shutdownSymbol: attempt(() => {
			self.shutdown[Symbol.for("slothlet.test.i625.namespace")] = 1;
		})
	};
}

/**
 * Keep `self.slothlet.materialize.get` and hand it back, for the host to call later from outside any call.
 * @returns {Function} The function as the module read it.
 * @example
 * keepMaterializeGet()(); // runs as the module that read it
 */
export function keepMaterializeGet() {
	return self.slothlet.materialize.get;
}

/**
 * Keep `self.slothlet` and hand back a function that writes to it later. The host calls that function
 * directly, after the call returned, so no module call is executing when it writes.
 * @returns {function(): Record<string, string>} Writes to the kept namespace and reports each outcome.
 * @example
 * const later = keepNamespace();
 * later(); // { assign: "LOOSE_SET_NOT_OWNED", … }
 */
export function keepNamespace() {
	const kept = self.slothlet;
	return function writeKept() {
		return {
			assign: attempt(() => {
				kept.lockCaller = () => "FAKE";
			}),
			remove: attempt(() => {
				delete kept.version;
			}),
			nested: attempt(() => {
				kept.hook.on = () => "FAKE";
			})
		};
	};
}

/**
 * Read and call members of the namespace, as a module normally does.
 * @returns {{version: string, lockCaller: string, has: boolean, ownLockCaller: string, hooks: boolean}} What it read.
 * @example
 * readAndCall();
 */
export function readAndCall() {
	return {
		version: self.slothlet.version,
		lockCaller: typeof self.slothlet.lockCaller,
		has: "lockCaller" in self.slothlet,
		ownLockCaller: typeof Object.getOwnPropertyDescriptor(self.slothlet, "lockCaller").value,
		hooks: Array.isArray(self.slothlet.hook.list()) || typeof self.slothlet.hook.list() === "object"
	};
}

/**
 * Write one member of the namespace, for a write the host has granted with a rule.
 * @param {string} name - Member to write.
 * @param {*} value - Value written.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * writeMember("hostGranted", 1);
 */
export function writeMember(name, value) {
	return attempt(() => {
		self.slothlet[name] = value;
	});
}

/**
 * Plant a setter-only accessor on `self.slothlet.permissions`, as a module could before #625.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * plantPermissionsSetter(); // "PERMISSION_DENIED"
 */
export function plantPermissionsSetter() {
	return attempt(() => {
		Object.defineProperty(self.slothlet.permissions, "__syntheticSetter", {
			configurable: true,
			enumerable: true,
			set() {}
		});
	});
}

/**
 * Read a member the host fixed on `self.slothlet.permissions` twice.
 * @returns {boolean} Whether both reads gave the same value.
 * @example
 * readHostFixed(); // true
 */
export function readHostFixed() {
	return self.slothlet.permissions.hostFixed === self.slothlet.permissions.hostFixed && self.slothlet.permissions.hostFixed.level === 1;
}
