/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/base.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T16:05:38-08:00 (1795651538)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The base of the wrapper's class chain and owner of its method table.
 *
 * `UnifiedWrapper` is built from layers, one per file in this folder, each a class over the one below:
 * `UnifiedWrapper extends TrapsLayer(…ValuesLayer(WrapperBase))`. What one layer's code uses of another's (functions,
 * shared state) goes through one table this file owns:
 *
 * - each layer puts its entries in it while its class is defined ({@link WrapperBase.define}), asks to be handed the
 *   table once the chain is complete ({@link WrapperBase.linkLayer}), and is recorded as a layer ({@link WrapperBase.layer});
 * - `UnifiedWrapper` registers the finished chain once, with a token only its own file holds
 *   ({@link WrapperBase.register}). That closes the table and hands it to each class in the registered chain, and to no
 *   other. That handoff is the only way to the table: no wrapper hands it out afterwards.
 *
 * Code that loads before slothlet and registers, defines or links first makes slothlet's own registration throw, so a
 * forged chain fails loudly instead of running beside the real one.
 * @module @cldmv/slothlet/handlers/unified-wrapper/base
 * @internal
 */
import { ComponentBase } from "#factories/component-base";
import { DEFAULT_CLOCK } from "#helpers/clock";
import { listPush, Objects, Reflect, WeakMap, WeakMapMethods, WeakSet, WeakSetMethods } from "#helpers/intrinsics";
import { ownBindingsRefusal } from "#helpers/instance-imports";

/** The registered class (`UnifiedWrapper`). @type {Function|undefined} */
let wrapperClass;
/**
 * The method table: one null-prototype group per layer (and `uw` for `unified-wrapper.mjs` itself), each holding the
 * entries that layer shares. Frozen once the chain is registered.
 * @type {object}
 */
const methods = { __proto__: null };
/** Each layer class to the function it is handed the table with. @type {WeakMap<Function, Function>} */
const linkers = new WeakMap();
/** The layer classes the layer files built ({@link WrapperBase.layer}). @type {WeakSet<Function>} */
const layers = new WeakSet();

/**
 * The refusal every misuse of the table gets.
 * @returns {Error} The refusal.
 */
function refusal() {
	return ownBindingsRefusal("lib/handlers/unified-wrapper/base", import.meta.url);
}

/**
 * The base of the wrapper's class chain.
 * @internal
 *
 * @description
 * An api node keeps a module's members as its own properties, so a member can take any name that is not the
 * framework's (`___` / `____`, see `isFrameworkName()` in `#helpers/reserved-keys`). Everything the wrapper reads of its
 * own state is therefore under such a name: the instance (`____slothlet`), its config, clock, id and error classes.
 * The base does not extend `ComponentBase`, whose accessors (`slothlet`, `clock`, `instanceID`, …) are legal member
 * names, so none of them is on the chain for framework code to reach by mistake.
 */
export class WrapperBase {
	/**
	 * The slothlet instance the node belongs to. A private field, so it is never an own property a Proxy invariant
	 * would make the get trap answer.
	 * @type {object}
	 */
	#slothlet;

	/**
	 * Complete set of property names reserved by the slothlet framework (`ComponentBase.INTERNAL_KEYS`).
	 * @type {Set<string>}
	 */
	static INTERNAL_KEYS = ComponentBase.INTERNAL_KEYS;

	/**
	 * @param {object} slothlet - The slothlet instance.
	 */
	constructor(slothlet) {
		this.#slothlet = slothlet;
	}

	/**
	 * The slothlet instance.
	 * @returns {object} The instance.
	 */
	get ____slothlet() {
		return this.#slothlet;
	}

	/**
	 * The instance's configuration.
	 * @returns {object} The configuration.
	 */
	get ____config() {
		return this.#slothlet.config;
	}

	/**
	 * The instance's clock, or the one slothlet loaded with for an instance (a test's stand-in) that has none.
	 * @returns {import("#helpers/clock").Clock} The clock.
	 */
	get ____clock() {
		return this.#slothlet.clock ?? DEFAULT_CLOCK;
	}

	/**
	 * The instance's id.
	 * @returns {string} The id.
	 */
	get ____instanceID() {
		return this.#slothlet.instanceID;
	}

	/**
	 * The instance's `SlothletError` class.
	 * @returns {Function} The class.
	 */
	get ____SlothletError() {
		return this.#slothlet.SlothletError;
	}

	/**
	 * The instance's `SlothletWarning` class.
	 * @returns {Function} The class.
	 */
	get ____SlothletWarning() {
		return this.#slothlet.SlothletWarning;
	}

	/**
	 * Put a layer's shared entries in the method table, under its group. Only before the chain is registered, and
	 * never over an entry already there.
	 * @param {string} group - The layer's group.
	 * @param {object} entries - Its entries.
	 * @returns {void}
	 */
	static define(group, entries) {
		if (wrapperClass !== undefined || typeof group !== "string") throw refusal();
		const into = methods[group] ?? (methods[group] = { __proto__: null });
		const keys = Objects.keys(entries);
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			if (key in into) throw refusal();
			into[key] = entries[key];
		}
	}

	/**
	 * Ask for the method table once the chain is registered. Only before that, once per class.
	 * @param {Function} layer - The layer's class.
	 * @param {function(object, Function): void} take - Called with the table and the registered class.
	 * @returns {void}
	 */
	static linkLayer(layer, take) {
		if (wrapperClass !== undefined || typeof take !== "function" || WeakMapMethods.has(linkers, layer)) throw refusal();
		WeakMapMethods.set(linkers, layer, take);
	}

	/**
	 * Record a class a layer file built for the chain, and hand it back. Only before the chain is registered;
	 * {@link WrapperBase.register} refuses a chain with any class between it and this one that was not recorded here.
	 * @param {Function} layer - The layer's class.
	 * @returns {*} The class.
	 */
	static layer(layer) {
		if (wrapperClass !== undefined || typeof layer !== "function" || WeakSetMethods.has(layers, layer)) throw refusal();
		WeakSetMethods.add(layers, layer);
		return layer;
	}

	/**
	 * Register the finished chain: once, from `UnifiedWrapper`'s own definition. Closes the table and hands it to each
	 * class of `cls`'s chain that asked for it.
	 * @param {Function} cls - The class (`UnifiedWrapper`).
	 * @param {symbol} token - The token only its file holds.
	 * @returns {void}
	 */
	static register(cls, token) {
		if (wrapperClass !== undefined || typeof token !== "symbol") throw refusal();
		// The chain from the registered class down to this one: every class below the registered one is a recorded layer.
		const chain = [cls];
		for (let current = Reflect.getPrototypeOf(cls); current !== WrapperBase; current = Reflect.getPrototypeOf(current)) {
			if (typeof current !== "function" || !WeakSetMethods.has(layers, current)) throw refusal();
			listPush(chain, current);
		}
		wrapperClass = cls;
		const groups = Objects.keys(methods);
		for (let i = 0; i < groups.length; i++) Objects.freeze(methods[groups[i]]);
		Objects.freeze(methods);
		for (let i = chain.length - 1; i >= 0; i--) {
			const take = WeakMapMethods.get(linkers, chain[i]);
			if (take !== undefined) take(methods, cls);
		}
	}
}
