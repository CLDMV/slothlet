/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_uwa_made/api/factory.mjs
 *	@Date: 2026-11-25T01:28:33-08:00 (1795598913)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:00-08:00 (1795869000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that makes functions, generators and plain values at run time and hands them out, and reads
 * what its caller hands back holding them.
 */

/** The function {@link keep} made, kept to be recognised when a caller hands it back. @type {Function|null} */
let kept = null;

/**
 * Make an async generator function with an own member beside its `name` and `length`, and no `name` of its own.
 * @returns {Function} The function.
 * @example
 * const make = makeAsyncGenerator();
 */
export function makeAsyncGenerator() {
	const made = async function* (limit) {
		for (let i = 0; i < limit; i++) yield i;
	};
	made.tag = "first";
	Reflect.deleteProperty(made, "name");
	return made;
}

/**
 * Read the `tag` of a function this module made, as the module holds it.
 * @param {Function} made - The function.
 * @returns {*} Its tag.
 * @example
 * tagOf(made);
 */
export function tagOf(made) {
	return made.tag;
}

/**
 * Make a generator object closed in one of the language's ways.
 * @param {"seal"|"preventExtensions"|"freeze"} how - How it is closed.
 * @returns {Generator<number>} The generator.
 * @example
 * makeClosedGenerator("seal");
 */
export function makeClosedGenerator(how) {
	const generator = (function* () {
		yield 1;
		yield 2;
	})();
	Object[how](generator);
	return generator;
}

/**
 * Make a function and keep it, so a caller handing it back can be recognised.
 * @returns {Function} The function.
 * @example
 * const fn = keep();
 */
export function keep() {
	kept = function keptFn() {
		return "kept";
	};
	return kept;
}

/**
 * Read and change a list the caller hands in, holding the function {@link keep} made.
 * @param {Array<*>} list - The list.
 * @returns {object} What the module saw.
 * @example
 * inspect([fn]);
 */
export function inspect(list) {
	const seen = {
		includes: list.includes(kept),
		first: list[0] === kept,
		described: Object.getOwnPropertyDescriptor(list, "0").value === kept,
		fixedKind: typeof Object.getOwnPropertyDescriptor(list, "fixed")?.value
	};
	list.push(function pushed() {
		return "pushed";
	});
	Object.defineProperty(list, "defined", {
		value: function defined() {
			return "defined";
		},
		configurable: true,
		enumerable: true,
		writable: true
	});
	Object.defineProperty(list, "accessor", { get: () => 1, configurable: true });
	const child = Object.create(list);
	child.inherited = kept;
	seen.childOwn = Object.hasOwn(child, "inherited") && !Object.hasOwn(list, "inherited");
	return seen;
}

/**
 * Make a plain object holding data of one kind, as a module hands out its own data.
 * @param {string} kind - Which data.
 * @returns {object} The object.
 * @example
 * makeData("collections");
 */
export function makeData(kind) {
	if (kind === "collections") return { map: new Map([["k", { n: 1 }]]), set: new Set([1, "two"]), nested: { list: [1, 2] } };
	if (kind === "error") {
		const error = new Error("outer", { cause: new Error("inner") });
		return { error };
	}
	if (kind === "errorAccessor") {
		const error = new Error("plain");
		Object.defineProperty(error, "message", { get: () => "from a getter", enumerable: false, configurable: true });
		return { error };
	}
	if (kind === "errorName") {
		const error = new Error("named");
		Object.defineProperty(error, "name", { get: () => "Custom", configurable: true });
		return { error };
	}
	if (kind === "boxed") return { text: Object("abc"), symbol: Object(Symbol.for("uwa")) };
	if (kind === "hidden") {
		const data = { shown: 1 };
		Object.defineProperty(data, "hidden", { value: 2, enumerable: false });
		data[Symbol.for("uwa.key")] = 3;
		return data;
	}
	if (kind === "accessor") {
		return {
			get value() {
				return 4;
			}
		};
	}
	return null;
}

/**
 * Hand back the list a caller handed in.
 * @param {Array<*>} list - The list.
 * @returns {Array<*>} The same list.
 * @example
 * echoList(list) === list;
 */
export function echoList(list) {
	return list;
}

/**
 * Hand out this file's own exported function, as plain JS hands out the function itself.
 * @returns {Function} The `keep` function.
 * @example
 * ownLeaf() === api.factory.keep;
 */
export function ownLeaf() {
	return keep;
}

/** A class of this module's. */
export class Widget {
	/**
	 * @returns {string} The kind.
	 */
	kind() {
		return "widget";
	}
}

/**
 * Hand out the prototype of this module's class.
 * @returns {object} `Widget.prototype`.
 * @example
 * widgetPrototype();
 */
export function widgetPrototype() {
	return Widget.prototype;
}

/** The tool {@link makeTool} made last, so the module can change it later. @type {object|null} */
let lastTool = null;

/**
 * Make an object holding code, with members of every kind: a method, a getter, a setter, a getter-less accessor, a
 * fixed getter, and data.
 * @param {"open"|"closed"} how - Whether the object is left open or closed to extension.
 * @returns {object} The tool.
 * @example
 * makeTool("open");
 */
export function makeTool(how) {
	const tool = {
		n: 1,
		run() {
			return "ran";
		},
		get doubled() {
			return this.n * 2;
		},
		set amount(value) {
			this.n = value;
		}
	};
	Object.defineProperty(tool, "setOnly", {
		set(value) {
			this.n = value;
		},
		enumerable: true,
		configurable: true
	});
	Object.defineProperty(tool, "fixedGet", {
		get() {
			return 5;
		},
		enumerable: true
	});
	if (how === "closed") Object.preventExtensions(tool);
	lastTool = tool;
	return tool;
}

/**
 * Delete a member of the tool {@link makeTool} made last.
 * @param {string} key - The member.
 * @returns {boolean} Whether it was deleted.
 * @example
 * dropFromTool("n");
 */
export function dropFromTool(key) {
	return delete lastTool[key];
}

/**
 * Make an object holding code and promises of the module's own.
 * @returns {{run: Function, pending: Promise<{n: number}>, failing: Promise<never>}} The bundle.
 * @example
 * makeBundle().pending;
 */
export function makeBundle() {
	const failing = Promise.reject(new Error("refused by the module"));
	failing.catch(() => {});
	return {
		run() {
			return 1;
		},
		pending: Promise.resolve({ n: 7 }),
		failing
	};
}

/**
 * Make a Proxy over an object holding a method, a getter and data, with a handler that forwards everything.
 * @returns {object} The proxy.
 * @example
 * makeProxy().n;
 */
export function makeProxy() {
	const target = {
		n: 1,
		run() {
			return "ran";
		},
		get doubled() {
			return this.n * 2;
		}
	};
	return new Proxy(target, {});
}
