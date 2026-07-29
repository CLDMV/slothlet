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
// Returns the context value itself (for an owner-locked key: the protected VIEW) so tests can hand
// it to a different writer — the view must enforce whoever writes it at write time, not this module.
export const getContextValue = (key) => context[key];

// Cross-file reads of terminal data values exported by db/secrets.mjs.
// Each read is a property access, not a call — gated only when permissions.readGating is on.
export const readToken = () => self.db.secrets.token;
export const readBytes = () => self.db.secrets.bytes;

// Reads a value by export name — used to sweep every terminal-value type.
export const readByName = (name) => self.db.secrets[name];

// Reads and calls made after yielding to the microtask/timer queue. Caller identity has to
// survive the await: an absent caller reads as host-initiated and is exempt, so losing it here
// would let any module past its deny rules simply by awaiting something first. Awaiting is
// mandatory for lazy access, so this is the ordinary shape of module code, not a corner case.
export const readTokenAfterAwait = async () => {
	await null;
	return self.db.secrets.token;
};
export const readTokenAfterTimer = async () => {
	await new Promise((resolve) => setTimeout(resolve, 1));
	return self.db.secrets.token;
};
export const insertAfterAwait = async () => {
	await null;
	return self.db.write.insert({ x: 1 });
};

// Enumeration / serialization of a namespace or object holding values this module cannot
// read directly. These must not disclose denied leaves — neither their values nor their
// existence — while leaving permitted leaves visible.
export const keysOfSecrets = async () => Object.keys(await self.db.secrets);
export const stringifySecrets = async () => JSON.stringify(await self.db.secrets);
export const keysOfConfig = async () => Object.keys(await self.db.secrets.config);
export const stringifyConfig = async () => JSON.stringify(await self.db.secrets.config);
export const entriesOfConfig = async () => Object.entries(await self.db.secrets.config);
export const spreadConfig = async () => ({ ...(await self.db.secrets.config) });

// Reads the same data value twice — exercises the cached-property read path.
export const readTokenTwice = () => {
	void self.db.secrets.token;
	return self.db.secrets.token;
};
