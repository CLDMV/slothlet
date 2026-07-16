/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/callers/data-reader-b.mjs
 *	@Date: 2026-05-19 12:00:00 -07:00 (1779217200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-19 12:00:00 -07:00 (1779217200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self, context } from "@cldmv/slothlet/runtime";

// Writes a context key from inside this module (apiPath `callers.dataReaderB`) — a DIFFERENT writer
// identity than data-reader.mjs, used to verify owner-locked context keys reject the wrong owner.
export const writeContext = (key, value) => {
	context[key] = value;
	return context[key];
};

// Nested write attributed to `callers.dataReaderB` — a DIFFERENT writer identity than data-reader.mjs,
// used to verify a nested write to an owner-locked key is rejected for the wrong owner.
export const writeNestedContext = (key, subkey, value) => {
	context[key][subkey] = value;
	return context[key][subkey];
};

// Second caller module that reads the same terminal data values as data-reader.mjs.
// Pairs with the multi-caller waiting-proxy regression test: the waitingProxyCache
// is keyed per-caller (caller API path + propChain) so two modules touching the
// same unmaterialized path never share one creation-time snapshot. Without this
// keying, the second module would inherit the first's captured caller identity
// and bypass its own deny rule (and audit attribution would credit the wrong
// reader). Request-context identity is layered on top of the cache structure to
// keep conditional rules evaluating against the actual reader's context.
export const readToken = () => self.db.secrets.token;
