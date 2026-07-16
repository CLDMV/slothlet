/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/callers/data-reader.mjs
 *	@Date: 2026-05-18 12:00:00 -07:00 (1779130800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-18 12:00:00 -07:00 (1779130800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self, context } from "@cldmv/slothlet/runtime";

// Writes a context key from inside this module (apiPath `callers.dataReader`). Used to exercise
// owner-locked / protected context keys: the runtime `context` set-trap resolves the writer identity
// from the executing module, so a write here is attributed to `callers.dataReader`.
export const writeContext = (key, value) => {
	context[key] = value;
	return context[key];
};

// Nested writes/reads through the runtime `context` proxy, attributed to `callers.dataReader`.
// Exercise deep protection of owner-locked keys: a write to a *nested* field of a protected/owned
// key must be enforced the same as a top-level write.
export const writeNestedContext = (key, subkey, value) => {
	context[key][subkey] = value;
	return context[key][subkey];
};
export const readNestedContext = (key, subkey) => context[key][subkey];
export const deleteNestedContext = (key, subkey) => {
	delete context[key][subkey];
	return context[key][subkey];
};
export const defineNestedContext = (key, subkey, value) => {
	Object.defineProperty(context[key], subkey, { value, writable: true, enumerable: true, configurable: true });
	return context[key][subkey];
};

// Cross-file reads of terminal data values exported by db/secrets.mjs.
// Each read is a property access, not a call — gated only when permissions.readGating is on.
export const readToken = () => self.db.secrets.token;
export const readBytes = () => self.db.secrets.bytes;

// Reads a value by export name — used to sweep every terminal-value type.
export const readByName = (name) => self.db.secrets[name];

// Reads the same data value twice — exercises the cached-property read path.
export const readTokenTwice = () => {
	void self.db.secrets.token;
	return self.db.secrets.token;
};
