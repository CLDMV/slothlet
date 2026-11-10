/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_body_mutable_arg/host/access.mjs
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
 * @fileoverview The host's own leaves of the leaf-body tests (#717), built in a file of the host's and mounted with
 * `api.slothlet.api.add(["host", "access"], makeAccess(() => api))`, the shape of rummage's `host.records.*`
 * (`src/ext-host/records.mjs`) and `host.callback.*` (`src/ext-host/callbacks.mjs`): leaves of an object a factory
 * returns, whose bodies call helpers of the same file, ask the permission system, or run a callback they were handed.
 * @module api_tests/api_test_leaf_body_mutable_arg/host/access
 */

/**
 * Run an access, reporting what it gave or the code and caller it was refused with.
 * @param {() => unknown} access - The access.
 * @returns {unknown} Its value, or `"<code>:<caller>"`.
 */
export function attempt(access) {
	try {
		return access();
	} catch (error) {
		return `${error?.code}:${error?.context?.caller ?? null}`;
	}
}

/**
 * A helper of the host's file that reads the vault, as rummage's `_repository` asks for a store partition.
 * @param {() => object} getApi - The host's api.
 * @returns {unknown} The vault's answer.
 */
function readVault(getApi) {
	return attempt(() => getApi().vault.get());
}

/**
 * Build the host's leaves.
 * @param {() => object} getApi - The host's api, once it exists.
 * @returns {Record<string, Function>} The leaves.
 * @example
 * await api.slothlet.api.add(["host", "access"], makeAccess(() => api), { moduleID: "host-access" });
 */
export function makeAccess(getApi) {
	return {
		register(_) {
			return attempt(() => getApi().vault.get());
		},
		viaHelper(_) {
			return readVault(getApi);
		},

		check(_) {
			return attempt(() => getApi().slothlet.permissions.global.checkAccess("project.hand", "vault.get"));
		},
		who(_) {
			return attempt(() => getApi().vault.whoami());
		},

		run(callback) {
			const own = readVault(getApi);
			return { own, handed: attempt(() => callback()), after: readVault(getApi) };
		},
		read(arg) {
			const own = readVault(getApi);
			return { own, handed: attempt(() => arg.id) };
		},
		convert(arg) {
			const own = readVault(getApi);
			return { own, handed: attempt(() => String(arg)) };
		},
		async later(_) {
			const before = readVault(getApi);
			await null;
			return { before, after: readVault(getApi) };
		},
		async awaitFirst(_) {
			await Promise.resolve();
			return readVault(getApi);
		},
		async timerFirst(_) {
			await new Promise((resolve) => setTimeout(resolve, 1));
			return readVault(getApi);
		},
		async awaitCheck(_) {
			await Promise.resolve();
			return attempt(() => getApi().slothlet.permissions.global.checkAccess("project.hand", "vault.get"));
		},
		async timerWho(_) {
			await new Promise((resolve) => setTimeout(resolve, 1));
			return attempt(() => getApi().vault.whoami());
		},
		async awaitRun(callback) {
			await Promise.resolve();
			const own = readVault(getApi);
			return { own, handed: attempt(() => callback()) };
		},
		deferFirst(callback) {
			// No identity read before the reaction: the handed code runs as a reaction of its own.
			return Promise.resolve()
				.then(callback)
				.then(
					(handed) => ({ handed }),
					(error) => ({ handed: `${error?.code}:${error?.context?.caller ?? null}` })
				);
		},
		defer(callback) {
			const own = readVault(getApi);
			// Run as a reaction of its own, with none of this file's frames on the stack below it.
			return Promise.resolve()
				.then(callback)
				.then(
					(handed) => ({ own, handed }),
					(error) => ({ own, handed: `${error?.code}:${error?.context?.caller ?? null}` })
				);
		}
	};
}
