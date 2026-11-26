/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_odd_promises/lib/promises.mjs
 *	@Date: 2026-11-25T01:48:28-08:00 (1795600108)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:07:22-08:00 (1795601242)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Promises of unusual shapes, made the way module code can make them.
 */

/**
 * A class with the given name.
 * @param {string} name - The name.
 * @param {Function} [Base=Promise] - What it extends.
 * @returns {Function} The class.
 */
const named = (name, Base = Promise) => ({ [name]: class extends Base {} })[name];

/**
 * A promise of the given shape, resolved with `value` (or left pending, for "pending").
 * @param {string} kind - The shape.
 * @param {*} value - What it resolves with.
 * @returns {Promise<*>} The promise.
 */
export function oddPromise(kind, value) {
	const promise = Promise.resolve(value);
	switch (kind) {
		case "plain":
			return promise;
		case "pending":
			return new Promise(() => {});
		case "ownAccessor":
			Object.defineProperty(promise, "extra", { get: () => 1 });
			return promise;
		case "ownObject":
			promise.extra = {};
			return promise;
		case "proxyProto":
			Object.setPrototypeOf(promise, new Proxy(Promise.prototype, {}));
			return promise;
		case "nullEnd":
			Object.setPrototypeOf(promise, Object.create(null));
			return promise;
		case "tagAccessor": {
			const Kind = named("TagAccessor");
			Object.defineProperty(Kind.prototype, Symbol.toStringTag, { get: () => "Tag" });
			return Kind.resolve(value);
		}
		case "tagBrace": {
			const Kind = named("TagBrace");
			Object.defineProperty(Kind.prototype, Symbol.toStringTag, { value: "a{b" });
			return Kind.resolve(value);
		}
		case "ctorAccessor": {
			const proto = Object.create(Promise.prototype, { constructor: { get: () => Promise } });
			Object.setPrototypeOf(promise, proto);
			return promise;
		}
		case "ctorBound": {
			const proto = Object.create(Promise.prototype, { constructor: { value: function Bound() {}.bind(null) } });
			Object.setPrototypeOf(promise, proto);
			return promise;
		}
		case "ctorProxy": {
			const proto = Object.create(Promise.prototype, { constructor: { value: new Proxy(function Proxied() {}, {}) } });
			Object.setPrototypeOf(promise, proto);
			return promise;
		}
		case "ctorNameAccessor": {
			const Kind = named("NameAccessor");
			Object.defineProperty(Kind, "name", { get: () => "NameAccessor" });
			return Kind.resolve(value);
		}
		case "ctorNameBrace":
			return named("Name{Brace").resolve(value);
		case "ctorHasInstance": {
			const Kind = named("HasInstance");
			Object.defineProperty(Kind, Symbol.hasInstance, { value: () => true });
			return Kind.resolve(value);
		}
		case "ctorPrototypeAccessor": {
			const ctor = function PrototypeAccessor() {};
			const fn = Object.defineProperty(ctor.bind(null), "prototype", { get: () => Promise.prototype });
			const proto = Object.create(Promise.prototype, { constructor: { value: fn } });
			Object.setPrototypeOf(promise, proto);
			return promise;
		}
		case "subclass":
			return named("Subclass").resolve(value);
		default:
			throw new TypeError(`unknown kind ${kind}`);
	}
}
