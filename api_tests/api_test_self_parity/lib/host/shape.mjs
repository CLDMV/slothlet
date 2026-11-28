/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_self_parity/lib/host/shape.mjs
 *	@Date: 2026-11-15T17:17:59-08:00 (1794791879)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:43-08:00 (1795868983)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What plain JavaScript reports of a value for each operation a caller can make on it, used to compare
 * a module's `self` with the host's `api` for the same instance (#803). The host's copy: the host running code of
 * a file an instance loaded, while a call of the instance is suspended, is taken for that module's code.
 */

/**
 * Run one operation, reporting a throw as its error code or name.
 * @param {function(): *} op - The operation.
 * @returns {*} Its result, or `threw:<code|name>`.
 */
function attempt(op) {
	try {
		return op();
	} catch (error) {
		return `threw:${error?.code ?? error?.name}`;
	}
}

/**
 * Name a prototype by what it is.
 * @param {*} proto - The prototype.
 * @returns {string} Its label.
 */
function protoLabel(proto) {
	if (proto === null) return "null";
	if (proto === Object.prototype) return "Object.prototype";
	if (proto === Function.prototype) return "Function.prototype";
	if (proto === Object.getPrototypeOf(async function () {})) return "AsyncFunction.prototype";
	return typeof proto;
}

/**
 * Name what a call or construction gave.
 * @param {*} value - The result.
 * @returns {*} A primitive as it is, otherwise its kind.
 */
function resultLabel(value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	return `${typeof value}:${protoLabel(Object.getPrototypeOf(value))}`;
}

/**
 * Report every operation on a value.
 * @param {*} x - The api root as the caller sees it.
 * @param {object} [extra] - Platform operations to include.
 * @param {function(*): string} [extra.inspect] - `util.inspect`, where there is one.
 * @returns {Record<string, *>} What each operation gave.
 */
export function shape(x, { inspect } = {}) {
	const rows = {
		typeof: typeof x,
		toStringTag: attempt(() => Object.prototype.toString.call(x)),
		// Only the fixture's own members are serialized: the `slothlet` namespace holds the process environment.
		json: attempt(() => JSON.stringify(x, ["math", "probe"])),
		jsonFullKind: attempt(() => typeof JSON.stringify(x)),
		instanceofFunction: attempt(() => x instanceof Function),
		instanceofObject: attempt(() => x instanceof Object),
		keys: attempt(() => Object.keys(x).sort()),
		ownKeys: attempt(() => Reflect.ownKeys(x).map(String).sort()),
		spreadKeys: attempt(() => Object.keys({ ...x }).sort()),
		inMath: attempt(() => "math" in x),
		inCall: attempt(() => "call" in x),
		hasOwnMath: attempt(() => Object.prototype.hasOwnProperty.call(x, "math")),
		mathDescriptor: attempt(() => {
			const desc = Object.getOwnPropertyDescriptor(x, "math");
			return desc ? Object.keys(desc).sort() : null;
		}),
		proto: attempt(() => protoLabel(Object.getPrototypeOf(x))),
		isExtensible: attempt(() => Object.isExtensible(x)),
		isArray: attempt(() => Array.isArray(x)),
		name: attempt(() => x.name),
		length: attempt(() => x.length),
		typeofCall: attempt(() => typeof x.call),
		typeofApply: attempt(() => typeof x.apply),
		typeofBind: attempt(() => typeof x.bind),
		mathAdd: attempt(() => x.math.add(2, 3)),
		directCall: attempt(() => resultLabel(x(2))),
		reflectApply: attempt(() => resultLabel(Reflect.apply(x, null, [2]))),
		construct: attempt(() => resultLabel(new x(2))),
		reflectConstruct: attempt(() => resultLabel(Reflect.construct(x, [2]))),
		dotCall: attempt(() => resultLabel(x.call(null, 2))),
		dotApply: attempt(() => resultLabel(x.apply(null, [2]))),
		bound: attempt(() => resultLabel(x.bind(null)(2))),
		functionToString: attempt(() => typeof Function.prototype.toString.call(x)),
		stringCoercion: attempt(() => typeof String(x))
	};
	if (inspect) rows.inspect = attempt(() => inspect(x));
	return rows;
}
