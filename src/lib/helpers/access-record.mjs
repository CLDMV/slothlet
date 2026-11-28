/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/access-record.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T00:00:00-08:00 (1795593600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The record of one access a context manager resolved already: the store it read its caller's identity from, and that identity, which the wrapper's reads take instead of resolving them again.
 * @module @cldmv/slothlet/helpers/access-record
 * @internal
 */

/**
 * An access whose identity its caller resolved already, on the store it read it from.
 * @param {object} contextManager - The context manager that resolved it.
 * @param {object|null|undefined} store - The store it was resolved on.
 * @param {object|undefined} identity - The identity.
 * @returns {object} The access.
 *
 * @example
 * runtime_selfView(value, undefined, null, resolvedAccess(liveRuntime, store, identity));
 */
export function resolvedAccess(contextManager, store, identity) {
	return { filled: true, done: false, manager: contextManager, store, identity };
}
