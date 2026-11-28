/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/handlers/metadata.mjs
 *	@Date: 2026-01-20T20:25:54-08:00 (1768969554)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:38-08:00 (1795869038)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Metadata API handler for accessing function metadata
 * @module @cldmv/slothlet/handlers/metadata
 * @internal
 * @package
 */

import { ComponentBase } from "#factories/component-base";
import { internals as unifiedWrapperInternals } from "#handlers/unified-wrapper";
import { verifyToken } from "#handlers/lifecycle-token";
import { FORK, writeTarget } from "#helpers/flow-stores";
import {
	ArrayMethods,
	Arrays,
	copyList,
	Map,
	mapEntries,
	MapMethods,
	Math,
	NumberMethods,
	Objects,
	regExpReplace,
	Set,
	setFrom,
	SetMethods,
	setToArray,
	setValues,
	splitText,
	StringMethods,
	Symbol,
	WeakMap,
	WeakMapMethods,
	WeakSet,
	WeakSetMethods
} from "#helpers/intrinsics";
const { resolveWrapper, metadataNodeOf } = unifiedWrapperInternals("lib/handlers/metadata");

/**
 * Internal delimiter joining a module's id and apiPath in the composite `moduleID` metadata key
 * (`` `${moduleID}${MODULE_ID_SEPARATOR}${apiPath}` ``). Deliberately a readable, slothlet-branded
 * multi-character token rather than a lone `:` — a `:` is common in real module ids (a `vine:abc`
 * namespacing convention, the internal `versionDispatcher:<path>` id), and using it as the splitter
 * made those ids un-round-trippable. A moduleID containing this token is refused at `add()`, so the
 * composite is always unambiguous to split.
 * @type {string}
 * @internal
 */
export const MODULE_ID_SEPARATOR = "__slothlet_sep__";

/**
 * Add-option key (a symbol, so no consumer option can name it) carrying the parsed `slothlet.module.json` of a package
 * mount from `modules.add` to the add that mounts it; reported as `slothlet.node(target).manifest`. Recorded with the
 * add, so a reload's replay records it again.
 * @type {symbol}
 * @internal
 */
export const MODULE_MANIFEST = Symbol("slothlet.moduleManifest");

/**
 * Metadata handler for introspection of function metadata
 * @class Metadata
 * @extends ComponentBase
 * @package
 */
/**
 * The handler {@link Metadata#[FORK]} is copying, read once by the constructor it calls; null otherwise.
 * @type {Metadata|null}
 * @private
 */
let forkingFrom = null;

/**
 * A copy of user metadata a later change to the original leaves as it is: plain objects (null-prototype ones included)
 * and arrays are copied all the way down; any other value is the same value.
 * @param {*} value - The metadata value.
 * @returns {*} The copy.
 * @private
 */
function copyMetadataValue(value) {
	if (Arrays.isArray(value)) {
		const copy = [];
		for (let index = 0; index < value.length; index++) copy[index] = copyMetadataValue(value[index]);
		return copy;
	}
	if (value === null || typeof value !== "object") return value;
	const proto = Objects.getPrototypeOf(value);
	if (proto !== null && proto !== Objects.prototype) return value;
	const copy = Objects.create(proto);
	// Defined, not assigned: an own `__proto__` key (as `JSON.parse` makes) stays an own key of the copy, where an
	// assignment would set the copy's prototype.
	for (let ofIndex = 0, keys = Objects.keys(value); ofIndex < keys.length; ofIndex++)
		Objects.defineProperty(copy, keys[ofIndex], {
			__proto__: null,
			value: copyMetadataValue(value[keys[ofIndex]]),
			writable: true,
			enumerable: true,
			configurable: true
		});
	return copy;
}

export class Metadata extends ComponentBase {
	static slothletProperty = "metadata";

	/** @type {string | null} */
	_instanceId = null;

	/**
	 * Create Metadata instance
	 * @param {Object} slothlet - Slothlet instance
	 */
	constructor(slothlet) {
		super(slothlet);
		const from = forkingFrom;
		if (from !== null) {
			forkingFrom = null;
			this._instanceId = from._instanceId;
			this.#copyFrom(from);
			return;
		}
		this._instanceId = `metadata_${this.clock.now()}_${StringMethods.substr(NumberMethods.toString(Math.random(), 36), 2, 9)}`;
	}

	// Secure WeakMap storage for immutable system metadata
	#secureMetadata = new WeakMap(); // target → system metadata (IMMUTABLE)

	/**
	 * The Metadata handler of the copy a full reload is replacing, asked for the system facts of a node this one never
	 * tagged, while the reload builds in a host with no AsyncLocalStorage (see readThrough); null otherwise.
	 * @type {Metadata|null}
	 */
	#readThrough = null;

	// Centralized user metadata storage - keyed by moduleID
	/** @type {Map<string, {metadata: object, apiPaths: Set<string>}>} */
	#userMetadataStore = new Map(); // moduleID → { metadata: {}, apiPaths: Set<string> }
	#globalUserMetadata = Objects.create(null); // global user metadata (applies to all)
	/** @type {Map<string, object>} */
	#manifests = new Map(); // raw moduleID → parsed slothlet.module.json of a package mount

	/**
	 * Which user metadata was written here since a full reload read this handler's state (see
	 * {@link Metadata#trackUserChanges}): global keys, and per store key the keys written or `true` for the whole entry.
	 * Null while no reload reads it.
	 * @type {{global: Set<string>, store: Map<string, Set<string>|true>}|null}
	 */
	#changes = null;

	/**
	 * Note a write of user metadata for {@link Metadata#takeUserChanges}, while a reload tracks this handler.
	 * @param {string|null} storeKey - The store key written, or null for global metadata.
	 * @param {string} [key] - The metadata key written; omitted for the whole entry.
	 * @returns {void}
	 * @private
	 */
	#noteChange(storeKey, key) {
		const changes = this.#changes;
		if (changes === null) return;
		if (storeKey === null) {
			SetMethods.add(changes.global, key);
			return;
		}
		const keys = MapMethods.get(changes.store, storeKey);
		if (keys === true) return;
		if (key === undefined) MapMethods.set(changes.store, storeKey, true);
		else if (keys === undefined) MapMethods.set(changes.store, storeKey, setFrom([key]));
		else SetMethods.add(keys, key);
	}

	/**
	 * Note a removal of user metadata (see {@link Metadata#noteChange}), with the key argument a remove takes.
	 * @param {string} storeKey - The store key.
	 * @param {string|string[]|Object<string, string[]>} [key] - The key(s) removed; omitted for the whole entry.
	 * @returns {void}
	 * @private
	 */
	#noteRemoval(storeKey, key) {
		if (this.#changes === null) return;
		if (key === undefined) this.#noteChange(storeKey);
		else if (typeof key === "string") this.#noteChange(storeKey, key);
		else if (Arrays.isArray(key)) {
			for (let ofIndex = 0; ofIndex < key.length; ofIndex++) if (typeof key[ofIndex] === "string") this.#noteChange(storeKey, key[ofIndex]);
		} else if (key !== null && typeof key === "object") {
			for (let ofIndex = 0, keys = Objects.keys(key); ofIndex < keys.length; ofIndex++) this.#noteChange(storeKey, keys[ofIndex]);
		}
	}

	/**
	 * A copy of this handler for a `run()` / `scope()` (see `FORK` in `helpers/flow-stores`): its user metadata (by
	 * module and by path) and global metadata, which later changes to either leave the other as it is. The system
	 * metadata nodes carry is the api tree's, and stays shared with it, as do the mounted manifests.
	 * @returns {Metadata} The copy.
	 * @internal
	 */
	[FORK]() {
		forkingFrom = this;
		return new Metadata(this.slothlet);
	}

	/**
	 * Fill a new handler from the one it is a copy of (see {@link Metadata#[FORK]}).
	 * @param {Metadata} from - The handler copied.
	 * @returns {void}
	 * @private
	 */
	#copyFrom(from) {
		this.#secureMetadata = from.#secureMetadata;
		this.#readThrough = from.#readThrough;
		this.#manifests = from.#manifests;
		this.#globalUserMetadata = copyMetadataValue(from.#globalUserMetadata);
		for (const ofEntry of mapEntries(from.#userMetadataStore)) {
			const entry = ofEntry[1];
			MapMethods.set(this.#userMetadataStore, ofEntry[0], {
				metadata: copyMetadataValue(entry.metadata),
				apiPaths: setFrom(setToArray(entry.apiPaths))
			});
		}
	}

	/**
	 * Merge metadata values while preserving nested plain-object structure.
	 *
	 * @param {unknown} currentValue - Existing metadata value.
	 * @param {unknown} nextValue - Incoming metadata value.
	 * @param {string} [argumentName="metadata"] - User-facing argument label for validation errors.
	 * @param {string|null} [metadataKey=null] - Optional metadata key being merged.
	 * @returns {unknown} Merged value.
	 * @private
	 */
	#mergeMetadataValue(currentValue, nextValue, argumentName = "metadata", metadataKey = null) {
		const utilities = this.slothlet.helpers?.utilities;
		if (metadataKey != null) {
			this.#assertSafeMetadataKeySegment(metadataKey);
		}

		if (utilities?.isPlainObject(currentValue) || Arrays.isArray(currentValue)) {
			this.#assertAcyclic(currentValue, argumentName, metadataKey);
		}
		if (utilities?.isPlainObject(currentValue)) {
			this.#assertNoReservedMetadataKeys(currentValue, metadataKey);
		}

		if (utilities?.isPlainObject(nextValue) || Arrays.isArray(nextValue)) {
			this.#assertAcyclic(nextValue, argumentName, metadataKey);
		}
		if (utilities?.isPlainObject(nextValue)) {
			this.#assertNoReservedMetadataKeys(nextValue, metadataKey);
		}

		if (utilities?.isPlainObject(currentValue) && utilities?.isPlainObject(nextValue)) {
			return utilities.deepMerge(currentValue, nextValue);
		}

		return nextValue;
	}

	/**
	 * Reject circular references in a metadata value, through plain objects and arrays in any mix
	 * (object → array → object, an array holding itself, …) before merging.
	 * Shared references across sibling branches are allowed because the recursion
	 * path is released on unwind; only back-edges on the active path throw.
	 *
	 * @param {unknown} value - Metadata value to validate (a plain object or an array).
	 * @param {string} argumentName - User-facing argument name used in the error context.
	 * @param {string|null} [metadataKey=null] - Optional metadata key being merged.
	 * @returns {void}
	 * @throws {SlothletError} INVALID_ARGUMENT when the value reaches itself.
	 * @private
	 */
	#assertAcyclic(value, argumentName, metadataKey = null) {
		const utilities = this.slothlet.helpers?.utilities;
		const isContainer = (candidate) => Arrays.isArray(candidate) || utilities.isPlainObject(candidate);
		// Only #mergeMetadataValue() calls this helper, and both call sites already guard with
		// a plain-object / array check before invoking it. The non-container early return is unreachable.
		/* v8 ignore if */
		if (!isContainer(value)) return;

		const validate = (candidate, ancestors = new WeakSet()) => {
			if (WeakSetMethods.has(ancestors, candidate)) {
				throw new this.SlothletError("INVALID_ARGUMENT", {
					argument: metadataKey ? `${argumentName}.${metadataKey}` : argumentName,
					expected: "acyclic object",
					received: "circular reference"
				});
			}

			WeakSetMethods.add(ancestors, candidate);
			try {
				for (let ofIndex = 0, ofList = Objects.values(candidate); ofIndex < ofList.length; ofIndex++) {
					const nestedValue = ofList[ofIndex];
					if (isContainer(nestedValue)) {
						validate(nestedValue, ancestors);
					}
				}
			} finally {
				WeakSetMethods.delete(ancestors, candidate);
			}
		};

		validate(value);
	}

	/**
	 * Reject metadata key segments that could mutate object prototypes.
	 *
	 * @param {string} key - Metadata key segment.
	 * @returns {void}
	 * @throws {SlothletError} METADATA_KEY_INVALID for reserved key segments.
	 * @private
	 */
	#assertSafeMetadataKeySegment(key) {
		const blocked = setFrom(["__proto__", "prototype", "constructor"]);
		if (typeof key !== "string" || key.length === 0) return;
		for (let ofIndex = 0, ofList = splitText(key, "."); ofIndex < ofList.length; ofIndex++) {
			const segment = ofList[ofIndex];
			if (SetMethods.has(blocked, segment)) {
				throw new this.SlothletError("METADATA_KEY_INVALID", {
					key,
					type: "string",
					expected: "safe dot-notation key without reserved segments"
				});
			}
		}
	}

	/**
	 * Reject reserved prototype-pollution keys recursively in plain-object metadata payloads.
	 *
	 * @param {object} value - Plain-object metadata payload.
	 * @param {string|null} [metadataKey=null] - Optional key prefix for error context.
	 * @returns {void}
	 * @throws {SlothletError} METADATA_KEY_INVALID for reserved key segments.
	 * @private
	 */
	#assertNoReservedMetadataKeys(value, metadataKey = null) {
		const blocked = setFrom(["__proto__", "prototype", "constructor"]);
		const utilities = this.slothlet.helpers?.utilities;

		const walk = (candidate, path = "") => {
			for (let ofIndex = 0, ofList = Objects.entries(candidate); ofIndex < ofList.length; ofIndex++) {
				const ofEntry = ofList[ofIndex],
					key = ofEntry[0],
					nestedValue = ofEntry[1];
				if (SetMethods.has(blocked, key)) {
					const fullPath = path ? `${path}.${key}` : key;
					const keyPath = metadataKey ? `${metadataKey}.${fullPath}` : fullPath;
					throw new this.SlothletError("METADATA_KEY_INVALID", {
						key: keyPath,
						type: "string",
						expected: "safe dot-notation key without reserved segments"
					});
				}

				if (utilities?.isPlainObject(nestedValue)) {
					walk(nestedValue, path ? `${path}.${key}` : key);
				}
			}
		};

		walk(value);
	}

	/**
	 * Deep freeze an object and all its nested properties
	 * @private
	 * @param {any} obj - Object to freeze
	 * @returns {any} Frozen object
	 */
	#deepFreeze(obj) {
		// Already frozen
		if (Objects.isFrozen(obj)) return obj;

		// Freeze the object itself
		Objects.freeze(obj);

		// Recursively freeze all properties
		ArrayMethods.forEach(Objects.getOwnPropertyNames(obj), (prop) => {
			if (obj[prop] !== null && typeof obj[prop] === "object") {
				this.#deepFreeze(obj[prop]);
			}
		});

		return obj;
	}

	/**
	 * Tag system metadata (SECURE, IMMUTABLE)
	 * Called internally during wrapper/function creation
	 *
	 * The `token` parameter must be the module-private `LIFECYCLE_TOKEN` Symbol exported
	 * from `#handlers/lifecycle-token`. Because a Symbol is a unique,
	 * non-forgeable value within a Node.js process, and because the token module is not
	 * listed in the package's public `exports` map, user-land code cannot construct a
	 * value that satisfies the `token === LIFECYCLE_TOKEN` check without modifying the
	 * source or importing an undocumented internal path.
	 *
	 * @param {Function|Object} target - Wrapper or function to tag
	 * @param {Object} systemData - System metadata (filePath, apiPath, moduleID, sourceFolder)
	 * @param {symbol} token - Must be `LIFECYCLE_TOKEN` — the unforgeable module-private Symbol
	 * @private
	 */
	tagSystemMetadata(target, systemData, token) {
		// ENFORCEMENT: caller must supply the per-instance lifecycle capability token.
		// The token is a Symbol created at runtime and stored in a module-private WeakMap
		// inside lifecycle-token.mjs — it is never exported as a constant, so no static
		// file import can yield a usable value.
		if (!verifyToken(this.slothlet, token)) {
			throw new this.SlothletError("METADATA_LIFECYCLE_BYPASS", {});
		}

		if (!target) return;

		// WeakMap only accepts objects/functions as keys
		if (typeof target !== "object" && typeof target !== "function") {
			return;
		}

		// Construct the composite moduleID as `${moduleID}${MODULE_ID_SEPARATOR}${apiPath/with/slashes}`.
		// It stays the per-path user-metadata key; the raw base id is also stored separately (baseModuleID)
		// so consumers recover the owning module without splitting. The separator is a reserved token no
		// moduleID may contain (enforced at add()), so a ':' — or any other character — is free in a
		// module id and the composite is always unambiguous to split (#303).
		let fullModuleID = systemData.moduleID;
		if (systemData.apiPath && systemData.moduleID) {
			const apiPathSlashes = regExpReplace(/\./g, systemData.apiPath, "/");
			fullModuleID = `${systemData.moduleID}${MODULE_ID_SEPARATOR}${apiPathSlashes}`;
		}

		// The folder the node was composed from, as its caller gives it: every caller passes one.
		const sourceFolder = systemData.sourceFolder;

		// Store in secure WeakMap (inaccessible externally)
		const frozenSystem = Objects.freeze({
			filePath: systemData.filePath,
			sourceFolder: sourceFolder,
			apiPath: systemData.apiPath,
			moduleID: fullModuleID,
			// Raw owning-module id, verbatim — the colon-safe source for base recovery (#303).
			baseModuleID: systemData.moduleID,
			taggedAt: this.clock.now()
		});

		WeakMapMethods.set(this.#secureMetadata, target, frozenSystem);
	}

	/**
	 * The system facts tagged on a node itself or on its impl, without the read-through a reload's window adds.
	 * @param {Function|Object} target - Wrapper, proxy or function.
	 * @returns {Object|undefined} The facts.
	 * @private
	 * @example
	 * this.#ownFacts(api.math.add).apiPath; // "math.add"
	 */
	#ownFacts(target) {
		const actualTarget = resolveWrapper(target) ?? target;
		return (
			WeakMapMethods.get(this.#secureMetadata, actualTarget) ||
			WeakMapMethods.get(this.#secureMetadata, actualTarget.____slothletInternal?.impl)
		);
	}

	/**
	 * The system facts a metadata call keys a node's user metadata by (#918).
	 *
	 * @description
	 * A stand-in a lazy node handed out for a member it had not loaded means the node it stands for: once that node has
	 * loaded, its own facts; until then, the facts it will have, its api path and the composite id built from it and the
	 * owning module, so what is set, read or removed through the stand-in is the loaded node's own entry. Any other value
	 * is looked up with `lookup`.
	 * @param {Function|Object} target - Wrapper, proxy or function.
	 * @param {function((Function|Object)): (Object|null|undefined)} lookup - How the facts of a node are found.
	 * @returns {Object|null|undefined} The facts.
	 * @private
	 * @example
	 * this.#nodeFacts(api.calls.ping, (node) => this.getSystemMetadata(node)).apiPath; // "calls.ping", loaded or not
	 */
	#nodeFacts(target, lookup) {
		const node = target && (typeof target === "object" || typeof target === "function") ? metadataNodeOf(target) : null;
		if (node === null || node.chain === null) return lookup(node === null ? target : node.wrapper);
		const holder = lookup(node.wrapper);
		if (!holder) return holder;
		const tail = ArrayMethods.join(node.chain, ".");
		const apiPath = holder.apiPath ? `${holder.apiPath}.${tail}` : tail;
		const baseModuleID = holder.baseModuleID;
		return {
			filePath: holder.filePath,
			sourceFolder: holder.sourceFolder,
			apiPath,
			moduleID: baseModuleID ? `${baseModuleID}${MODULE_ID_SEPARATOR}${regExpReplace(/\./g, apiPath, "/")}` : holder.moduleID,
			baseModuleID
		};
	}

	/**
	 * The system facts slothlet recorded for a node: its file, folder, api path and owning module.
	 *
	 * @description
	 * Looked up on the wrapper first, then on its impl (for a node whose wrapper was never tagged), the order every
	 * reader uses, so set(), get() and node() always agree on which node they mean. Internal only: consumers read
	 * these facts through `slothlet.node(target)`; user metadata never carries them.
	 *
	 * @param {Function|Object} target - Wrapper, proxy or function.
	 * @returns {{filePath: string, sourceFolder: string, apiPath: string, moduleID: string, baseModuleID: string, taggedAt: number}|null}
	 *   The frozen system record, or null when the target was never tagged.
	 * @package
	 * @example
	 * metadata.getSystemMetadata(api.math.add)?.baseModuleID; // "base"
	 */
	getSystemMetadata(target) {
		if (!target || (typeof target !== "object" && typeof target !== "function")) return null;
		const actualTarget = resolveWrapper(target) ?? target;
		const impl = actualTarget.____slothletInternal?.impl;
		return (
			WeakMapMethods.get(this.#secureMetadata, actualTarget) ||
			(impl && (typeof impl === "object" || typeof impl === "function") ? WeakMapMethods.get(this.#secureMetadata, impl) : undefined) ||
			(this.#readThrough !== null ? this.#readThrough.getSystemMetadata(target) : null) ||
			null
		);
	}

	/**
	 * While a full reload builds its new copy in a host with no AsyncLocalStorage, calls reach the new copy's handler,
	 * and the nodes they run are the copy the instance has: this handler answers the system facts of those nodes from
	 * that copy's handler until the reload ends.
	 * @param {Metadata|null} handler - The handler of the copy being replaced, or null to stop.
	 * @returns {void}
	 * @package
	 * @example
	 * metadata.readThrough(previous.metadata);
	 */
	readThrough(handler) {
		this.#readThrough = handler === this ? null : (handler ?? null);
	}

	/**
	 * The user metadata of a node: global < api path chain < the node's own.
	 *
	 * @description
	 * Only what consumers set (through `metadata.global`, `metadata.set`, or the `metadata` option of an add). The system
	 * facts slothlet records (file, folder, path, module) are never merged in; `slothlet.node(target)` reports them.
	 *
	 * @param {Function|Object} target - Wrapper, proxy or function.
	 * @returns {Object} The merged user metadata (deeply frozen).
	 * @public
	 * @example
	 * metadata.getMetadata(api.math.add); // { category: "math" }
	 */
	getMetadata(target) {
		if (!target) return this.#deepFreeze({ ...this.#globalUserMetadata });
		const systemData = this.#nodeFacts(target, (node) => this.getSystemMetadata(node)) ?? {};

		// Lookup user metadata by BOTH moduleID AND rootApiPath
		// - registerUserMetadata() stores by root apiPath (for api.add())
		// - setUserMetadata() stores by moduleID (for external metadata.set())
		const moduleID = systemData.moduleID;
		const apiPath = systemData.apiPath;

		const userMetadataByModule = moduleID ? MapMethods.get(this.#userMetadataStore, moduleID) : null;
		const userMetadataByPath = apiPath ? this.#collectPathChain(apiPath) : {};

		// Merge order: global < user (by path) < user (by moduleID)
		const combined = {
			...this.#globalUserMetadata,
			...userMetadataByPath,
			...(userMetadataByModule?.metadata || {})
		};

		// If there's a nested 'metadata' key, spread it to root level and remove the nested key
		if (combined.metadata && typeof combined.metadata === "object") {
			const { metadata, ...rest } = combined;
			return this.#deepFreeze({
				...rest,
				...metadata
			});
		}

		return this.#deepFreeze(combined);
	}

	/**
	 * Merge the path-store entries along an api path, root to leaf (closer to the leaf wins).
	 * @param {string} apiPath - Dot-notation api path.
	 * @returns {Object} The merged entries.
	 * @private
	 * @example
	 * this.#collectPathChain("math.add"); // entries of "math" then "math.add"
	 */
	#collectPathChain(apiPath) {
		const parts = splitText(apiPath, ".");
		const collected = {};
		for (let i = 1; i <= parts.length; i++) {
			const parentPath = ArrayMethods.join(copyList(parts, 0, i), ".");
			const parentMeta = MapMethods.get(this.#userMetadataStore, parentPath);
			if (parentMeta?.metadata) {
				Objects.assign(collected, parentMeta.metadata);
			}
		}
		return collected;
	}

	/**
	 * Record (or clear) the parsed `slothlet.module.json` of a package mount, reported as `node(target).manifest`.
	 * @param {string} moduleID - The raw module id of the mount.
	 * @param {object|null|undefined} manifest - The normalized manifest, or nothing to clear it.
	 * @returns {void}
	 * @package
	 * @example
	 * metadata.setModuleManifest("pkg-a", manifest);
	 */
	setModuleManifest(moduleID, manifest) {
		if (typeof moduleID !== "string") return;
		if (manifest && typeof manifest === "object") MapMethods.set(this.#manifests, moduleID, manifest);
		else MapMethods.delete(this.#manifests, moduleID);
	}

	/**
	 * The parsed `slothlet.module.json` of the package mount that owns a module id.
	 * @param {string|null|undefined} moduleID - The raw module id.
	 * @returns {object|undefined} The manifest, or undefined when the module is no package mount.
	 * @package
	 * @example
	 * metadata.getModuleManifest("pkg-a")?.name; // "@acme/pkg-a"
	 */
	getModuleManifest(moduleID) {
		return typeof moduleID === "string" ? MapMethods.get(this.#manifests, moduleID) : undefined;
	}

	/**
	 * Set global user metadata (applies to all functions)
	 * @param {string} key - Metadata key
	 * @param {unknown} value - Metadata value
	 * @public
	 */
	setGlobalMetadata(key, value) {
		const written = writeTarget(this);
		if (written !== this) return written.setGlobalMetadata(key, value);
		this.#globalUserMetadata[key] = this.#mergeMetadataValue(this.#globalUserMetadata[key], value, "metadata", key);
		this.#noteChange(null, key);
	}

	/**
	 * Add/update user metadata for specific function
	 * @param {Function} target - Function to tag with metadata
	 * @param {string} key - Metadata key
	 * @param {unknown} value - Metadata value
	 * @public
	 */
	setUserMetadata(target, key, value) {
		const written = writeTarget(this);
		if (written !== this) return written.setUserMetadata(target, key, value);
		if (typeof target !== "function" && typeof target !== "object") {
			throw new this.SlothletError("METADATA_TARGET_INVALID", {
				target: typeof target,
				expected: "function or object"
			});
		}

		// The node's system facts, wrapper-first (the lookup order getMetadata uses), so set() and get() resolve to the same
		// moduleID even after a reload (the wrapper keeps its moduleID while the impl gets a new one), and a stand-in for a
		// lazy member not loaded yet to the entry the loaded node has (#918).
		const systemData = this.#nodeFacts(target, (node) => this.#ownFacts(node)) || {};
		const moduleID = systemData.moduleID;

		if (!moduleID) {
			throw new this.SlothletError("METADATA_NO_MODULE", {});
		}

		// Get or create user metadata entry for this moduleID
		let entry = MapMethods.get(this.#userMetadataStore, moduleID);
		if (!entry) {
			entry = { metadata: {}, apiPaths: new Set() };
			MapMethods.set(this.#userMetadataStore, moduleID, entry);
		}

		// Set the metadata key
		entry.metadata[key] = this.#mergeMetadataValue(entry.metadata[key], value, "metadata", key);
		this.#noteChange(moduleID, key);

		// ALSO store by apiPath so path-based lookups survive moduleID changes after reload.
		// collectMetadataFromParents() in getMetadata() traverses the path hierarchy and
		// will find this entry even when the moduleID has changed (e.g. after api.slothlet.reload()).
		const apiPath = systemData.apiPath;
		if (apiPath) {
			let pathEntry = MapMethods.get(this.#userMetadataStore, apiPath);
			if (!pathEntry) {
				pathEntry = { metadata: {}, apiPaths: new Set() };
				MapMethods.set(this.#userMetadataStore, apiPath, pathEntry);
			}
			pathEntry.metadata[key] = this.#mergeMetadataValue(pathEntry.metadata[key], value, "metadata", key);
			SetMethods.add(pathEntry.apiPaths, apiPath);
			this.#noteChange(apiPath, key);
		}
	}

	/**
	 * Remove user metadata from specific function
	 * @param {Function} target - Function to remove metadata from
	 * @param {string|string[]|Object<string, string[]>} [key] - Optional key(s) to remove (removes all if omitted). Can be:
	 *   - string: Remove single key
	 *   - string[]: Remove multiple keys (each element must be a string)
	 *   - {key: string[]}: Remove nested keys from object values
	 * @public
	 */
	removeUserMetadata(target, key) {
		const written = writeTarget(this);
		if (written !== this) return written.removeUserMetadata(target, key);
		if (typeof target !== "function" && typeof target !== "object") {
			throw new this.SlothletError("METADATA_TARGET_INVALID", {
				target: typeof target,
				expected: "function or object"
			});
		}

		// The node's moduleID and apiPath, as setUserMetadata() resolves them.
		const systemData = this.#nodeFacts(target, (node) => this.#ownFacts(node)) || {};
		const moduleID = systemData.moduleID;
		const apiPath = systemData.apiPath;

		if (!moduleID) return;

		// Helper to apply removal to a single store entry
		const applyRemoval = (storeKey) => {
			const storeEntry = MapMethods.get(this.#userMetadataStore, storeKey);
			if (!storeEntry) return;
			this.#noteRemoval(storeKey, key);

			if (key === undefined) {
				MapMethods.delete(this.#userMetadataStore, storeKey);
			} else if (Arrays.isArray(key)) {
				for (let ofIndex = 0, ofList = key; ofIndex < ofList.length; ofIndex++) {
					const k = ofList[ofIndex];
					if (typeof k !== "string") {
						throw new this.SlothletError("METADATA_KEY_INVALID", {
							key: k,
							type: typeof k,
							expected: "string"
						});
					}
					delete storeEntry.metadata[k];
				}
			} else if (typeof key === "object" && key !== null) {
				for (let ofIndex = 0, ofList = Objects.entries(key); ofIndex < ofList.length; ofIndex++) {
					const ofEntry = ofList[ofIndex],
						metadataKey = ofEntry[0],
						nestedKeys = ofEntry[1];
					if (!Arrays.isArray(nestedKeys)) {
						throw new this.SlothletError("METADATA_KEY_INVALID", {
							key: metadataKey,
							type: typeof nestedKeys,
							expected: "array"
						});
					}
					const metadataValue = storeEntry.metadata[metadataKey];
					if (metadataValue && typeof metadataValue === "object") {
						for (let ofIndex = 0, ofList = nestedKeys; ofIndex < ofList.length; ofIndex++) {
							const nestedKey = ofList[ofIndex];
							if (typeof nestedKey !== "string") {
								throw new this.SlothletError("METADATA_KEY_INVALID", {
									key: nestedKey,
									type: typeof nestedKey,
									expected: "string"
								});
							}
							delete metadataValue[nestedKey];
						}
					}
				}
			} else if (typeof key === "string") {
				delete storeEntry.metadata[key];
			} else {
				throw new this.SlothletError("METADATA_KEY_INVALID", {
					key: key,
					type: typeof key,
					expected: "string, string[], or object"
				});
			}
		};

		// Apply removal to both the moduleID entry and the apiPath entry.
		// setUserMetadata() stores under both keys, so both must be cleaned up.
		applyRemoval(moduleID);
		if (apiPath && apiPath !== moduleID) {
			applyRemoval(apiPath);
		}
	}

	/**
	 * Register user metadata keyed by an identifier (moduleID or API path)
	 *
	 * @description
	 * Stores user-provided metadata in `#userMetadataStore` under the given
	 * `identifier`. The identifier is treated opaquely — callers pass either a
	 * generated moduleID (e.g. `base_slothlet`) or a dot-notation API path
	 * (e.g. `math`). `getMetadata()` retrieves entries using the same key via
	 * both the moduleID lookup and `collectMetadataFromParents`, so storing
	 * under a single key is sufficient for both cases.
	 *
	 * Multiple calls to the same identifier are merged; later calls override
	 * earlier scalar values, while nested plain objects merge recursively.
	 *
	 * @param {string} identifier - Module ID or dot-notation API path
	 * @param {Object} metadata - User metadata object to merge
	 * @package
	 */
	registerUserMetadata(identifier, metadata) {
		if (!identifier || typeof identifier !== "string") {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "identifier",
				expected: "non-empty string",
				received: typeof identifier
			});
		}

		let entry = MapMethods.get(this.#userMetadataStore, identifier);
		if (!entry) {
			entry = { metadata: {}, apiPaths: new Set() };
			MapMethods.set(this.#userMetadataStore, identifier, entry);
		}
		// Merge incoming metadata over any existing values while preserving nested plain objects.
		entry.metadata = this.#mergeMetadataValue(entry.metadata, metadata, "metadata");
		// Track identifier in apiPaths so cleanup via removeUserMetadataByApiPath() works
		SetMethods.add(entry.apiPaths, identifier);
		if (this.#changes !== null) {
			for (let ofIndex = 0, keys = Objects.keys(metadata); ofIndex < keys.length; ofIndex++) this.#noteChange(identifier, keys[ofIndex]);
		}
	}

	/**
	 * Remove all user metadata for an apiPath
	 *
	 * @description
	 * Cleanup method to remove all user metadata associated with an apiPath.
	 * Used during api.remove() or cleanup operations.
	 *
	 * @param {string} apiPath - API path to remove
	 * @package
	 */
	removeUserMetadataByApiPath(apiPath) {
		if (!apiPath) return;
		MapMethods.delete(this.#userMetadataStore, apiPath);
		this.#noteChange(apiPath);
	}

	/**
	 * Set metadata for all functions reachable at an API path.
	 *
	 * @description
	 * Stores metadata keyed by `apiPath` so that every function whose system
	 * `apiPath` starts with (or equals) the given path inherits the values via
	 * `collectMetadataFromParents()` in `getMetadata()`.
	 *
	 * Accepts either a single key/value pair or a plain object to merge.
	 * Multiple calls to the same path are merged; later calls override earlier
	 * ones for conflicting keys.
	 *
	 * Priority (lowest → highest): global → path (closer to the leaf wins) → the function's own.
	 *
	 * @param {string} apiPath - Dot-notation path (e.g. `"math"`, `"math.add"`)
	 * @param {string|Object} keyOrObj - Key string (with `value`) OR metadata object to merge
	 * @param {unknown} [value] - Value when `keyOrObj` is a string key
	 * @public
	 */
	setPathMetadata(apiPath, keyOrObj, value) {
		const written = writeTarget(this);
		if (written !== this) return written.setPathMetadata(apiPath, keyOrObj, value);
		if (typeof apiPath !== "string" || !apiPath) {
			throw new this.SlothletError("INVALID_ARGUMENT", { argument: "apiPath", expected: "non-empty string", received: typeof apiPath });
		}

		const metadataObj = typeof keyOrObj === "string" ? { [keyOrObj]: value } : keyOrObj;

		if (!metadataObj || typeof metadataObj !== "object" || Arrays.isArray(metadataObj)) {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "keyOrObj",
				expected: "string key or plain object",
				received: typeof keyOrObj
			});
		}

		this.registerUserMetadata(apiPath, metadataObj);
	}

	/**
	 * Get the user metadata collected from the path store for a given API path.
	 *
	 * @description
	 * Traverses from root segment to leaf, merging parent → child metadata — the same
	 * traversal used by `collectMetadataFromParents` inside `getMetadata()`. Does not
	 * include immutable system metadata; only user-supplied path store entries are returned.
	 *
	 * @param {string} apiPath - Dot-notation API path (e.g. `"v1.auth"`, `"math"`).
	 * @returns {Object} Merged user metadata for the path (not frozen).
	 * @public
	 * @example
	 * metadata.getPathMetadata("v1.auth"); // { stable: true, category: "auth" }
	 */
	getPathMetadata(apiPath) {
		// All callers (metadata.get) always pass a valid resolved string; the null/non-string guard is defensive.
		/* v8 ignore if */
		if (!apiPath || typeof apiPath !== "string") return {};
		return { ...this.#globalUserMetadata, ...this.#collectPathChain(apiPath) };
	}

	/**
	 * Remove metadata keys (or all metadata) for an API path.
	 *
	 * @description
	 * Removes one specific key, multiple keys, or ALL user metadata stored under
	 * the given `apiPath` key in the path store.
	 * Only affects metadata set via `setForPath()` / `registerUserMetadata()` for
	 * this exact path segment - it does not walk descendant paths.
	 *
	 * @param {string} apiPath - Dot-notation path (e.g. `"math"`, `"math.add"`)
	 * @param {string|string[]} [key] - Key(s) to remove. Omit to remove all metadata for the path.
	 * @public
	 */
	removePathMetadata(apiPath, key) {
		const written = writeTarget(this);
		if (written !== this) return written.removePathMetadata(apiPath, key);
		if (!apiPath || typeof apiPath !== "string") return;

		const entry = MapMethods.get(this.#userMetadataStore, apiPath);
		if (!entry) return;
		this.#noteRemoval(apiPath, key);

		if (key === undefined) {
			MapMethods.delete(this.#userMetadataStore, apiPath);
		} else if (Arrays.isArray(key)) {
			for (let ofIndex = 0, ofList = key; ofIndex < ofList.length; ofIndex++) {
				const k = ofList[ofIndex];
				if (typeof k !== "string") {
					throw new this.SlothletError("METADATA_KEY_INVALID", {
						key: k,
						type: typeof k,
						expected: "string"
					});
				}
				delete entry.metadata[k];
			}
		} else if (typeof key === "string") {
			delete entry.metadata[key];
		} else {
			throw new this.SlothletError("METADATA_KEY_INVALID", {
				key,
				type: typeof key,
				expected: "string or string[]"
			});
		}
	}

	/**
	 * Export user-managed metadata state for preservation across reload.
	 *
	 * @description
	 * Captures `#globalUserMetadata` and all entries in `#userMetadataStore`
	 * so they can be restored to a fresh Metadata instance after reload.
	 * Called by `slothlet.reload()` BEFORE `load()` destroys this instance.
	 *
	 * @returns {{ globalMetadata: Object, userMetadataStore: Map }} Snapshot of user state
	 * @package
	 */
	exportUserState() {
		const storeCopy = new Map();
		for (const ofEntry of mapEntries(this.#userMetadataStore)) {
			const key = ofEntry[0],
				entry = ofEntry[1];
			MapMethods.set(storeCopy, key, {
				metadata: { ...entry.metadata },
				apiPaths: setFrom(setToArray(entry.apiPaths))
			});
		}
		return {
			globalMetadata: { ...this.#globalUserMetadata },
			userMetadataStore: storeCopy
		};
	}

	/**
	 * Restore user-managed metadata state after a fresh load.
	 *
	 * @description
	 * Merges previously exported state into the new (empty) Metadata instance.
	 * Called by `slothlet.reload()` AFTER `load()` creates the new instance and
	 * BEFORE operation-history replay so that `registerUserMetadata()` from replay
	 * can properly merge over the restored base state.
	 *
	 * Merge priority: existing (from load) > saved state.
	 * This means replay-registered api.add metadata overrides restored values
	 * for the same key, which is the desired behaviour.
	 *
	 * @param {{ globalMetadata: Object, userMetadataStore: Map }} state - Previously exported state
	 * @package
	 */
	importUserState(state) {
		const written = writeTarget(this);
		if (written !== this) return written.importUserState(state);
		if (!state) return;

		// Restore global metadata (merge, existing keys win)
		if (state.globalMetadata) {
			for (let ofIndex = 0, ofList = Objects.entries(state.globalMetadata); ofIndex < ofList.length; ofIndex++) {
				const ofEntry = ofList[ofIndex],
					k = ofEntry[0],
					v = ofEntry[1];
				if (!(k in this.#globalUserMetadata)) {
					this.#globalUserMetadata[k] = v;
				}
			}
		}

		// Restore user metadata store entries (merge, existing keys win)
		if (state.userMetadataStore) {
			for (const ofEntry of mapEntries(state.userMetadataStore)) {
				const key = ofEntry[0],
					savedEntry = ofEntry[1];
				const existing = MapMethods.get(this.#userMetadataStore, key);
				if (!existing) {
					// No current entry - restore the saved one directly
					MapMethods.set(this.#userMetadataStore, key, {
						metadata: { ...savedEntry.metadata },
						apiPaths: setFrom(setToArray(savedEntry.apiPaths))
					});
				} else {
					// Merge: saved values fill in missing keys; existing keys (from load) win
					existing.metadata = { ...savedEntry.metadata, ...existing.metadata };
					for (const p of setValues(savedEntry.apiPaths)) SetMethods.add(existing.apiPaths, p);
				}
			}
		}
	}

	/**
	 * Start keeping which user metadata is written to this handler, for a full reload that has just read its state
	 * ({@link Metadata#exportUserState}) and builds its new copy while this handler keeps answering calls: what those
	 * calls write is handed to the new copy at the swap ({@link Metadata#takeUserChanges}).
	 * @returns {void}
	 * @package
	 */
	trackUserChanges() {
		this.#changes = { global: new Set(), store: new Map() };
	}

	/**
	 * Stop keeping which user metadata is written here (a reload that ended without taking it).
	 * @returns {void}
	 * @package
	 */
	endUserChanges() {
		this.#changes = null;
	}

	/**
	 * Take the user metadata written to `from` since its {@link Metadata#trackUserChanges}: each key written there has
	 * here the value it has there, and one removed there is removed here. Written later than anything this handler has,
	 * it wins over it. Ends `from`'s tracking.
	 * @param {Metadata} from - The handler of the copy a full reload replaces.
	 * @returns {void}
	 * @package
	 */
	takeUserChanges(from) {
		const written = writeTarget(this);
		if (written !== this) return written.takeUserChanges(from);
		// Defensive: a reload always hands the old copy's own handler, which it set tracking on.
		/* v8 ignore if */
		if (!(from instanceof Metadata) || from === this || from.#changes === null) return;
		const changes = from.#changes;
		from.#changes = null;
		// Global metadata is only ever set, never removed: each key noted is there.
		for (const key of setValues(changes.global)) this.#globalUserMetadata[key] = copyMetadataValue(from.#globalUserMetadata[key]);
		for (const ofEntry of mapEntries(changes.store)) {
			const storeKey = ofEntry[0],
				keys = ofEntry[1];
			const source = MapMethods.get(from.#userMetadataStore, storeKey);
			if (keys === true) {
				if (source) {
					MapMethods.set(this.#userMetadataStore, storeKey, {
						metadata: copyMetadataValue(source.metadata),
						apiPaths: setFrom(setToArray(source.apiPaths))
					});
				} else MapMethods.delete(this.#userMetadataStore, storeKey);
				continue;
			}
			let entry = MapMethods.get(this.#userMetadataStore, storeKey);
			for (const key of setValues(keys)) {
				if (source && Objects.hasOwn(source.metadata, key)) {
					if (!entry) {
						entry = { metadata: {}, apiPaths: new Set() };
						MapMethods.set(this.#userMetadataStore, storeKey, entry);
					}
					entry.metadata[key] = copyMetadataValue(source.metadata[key]);
				} else if (entry) delete entry.metadata[key];
			}
			if (source && entry) for (const apiPath of setValues(source.apiPaths)) SetMethods.add(entry.apiPaths, apiPath);
		}
	}

	/**
	 * The currently-executing API function, as a caller object ({ path, module, metadata, version }).
	 *
	 * Reads `currentWrapper` from the active context-manager store — the same
	 * fast synchronous path used by the unified wrapper's `apply` trap.
	 * Throws `CONTEXT_NOT_ACTIVE` when called outside of a slothlet
	 * execution context.
	 *
	 * Called by the `api.slothlet.metadata.self()` closure injected in
	 * `slothlet.injectRuntimeMetadataFunctions()`.
	 *
	 * @returns {{path: string[], module: string|null, metadata: object, version: object|null}} The current leaf, as a caller object
	 * @public
	 */
	self() {
		// Scoped to this instance: under the live runtime the active-instance field is shared by every
		// instance, so with another instance in flight an unscoped read can resolve against that one (#592).
		const instanceID = this.slothlet.instanceID;
		const ctx = this.slothlet.contextManager?.tryGetContext(instanceID);
		// Identity via the context manager rather than off the store: under the live runtime
		// `currentWrapper` is one field shared by every in-flight call, so a module resuming from an
		// `await` while another is suspended would be handed the *other* module's metadata.
		const currentWrapper = this.slothlet.contextManager?.getCallerIdentity?.(instanceID)?.currentWrapper;
		if (!ctx || !currentWrapper) {
			throw new this.SlothletError("CONTEXT_NOT_ACTIVE", {});
		}
		return this.#identity(currentWrapper);
	}

	/**
	 * The API function that called the current function, as a caller object ({ path, module, metadata, version }).
	 *
	 * Reads `callerWrapper` from the active context-manager store.
	 * Returns `null` when there is no caller in context (e.g. the function
	 * was invoked directly from outside the API).
	 *
	 * Called by the `api.slothlet.metadata.caller()` closure injected in
	 * `slothlet.injectRuntimeMetadataFunctions()`.
	 *
	 * @returns {{path: string[], module: string|null, metadata: object, version: object|null}|null} The calling leaf, as a caller object, or null
	 * @public
	 */
	caller() {
		const callerWrapper = this.callerWrapper();
		if (!callerWrapper) return null;
		return this.#identity(callerWrapper);
	}

	/**
	 * The `caller` object of a leaf, the one shape slothlet hands out for "who": `{ path, module, metadata, version }`
	 * (its api path as segments, its module id, its user metadata, its version record or null). The same object a
	 * version dispatcher and an around hook get.
	 * @param {object} wrapper - The leaf's wrapper.
	 * @returns {{path: string[], module: string|null, metadata: object, version: object|null}} The caller object.
	 * @private
	 * @example
	 * this.#identity(currentWrapper).path; // ["payments", "charge"]
	 */
	#identity(wrapper) {
		const built = this.slothlet.handlers?.versionManager?.buildCallerArg?.(wrapper);
		// The version manager is always registered, so `built` is always set; the fallback keeps the shape without one.
		/* v8 ignore else */
		if (built) return built;
		/* v8 ignore start */
		const system = this.getSystemMetadata(wrapper);
		return {
			path: system?.apiPath ? splitText(system.apiPath, ".") : [],
			module: system?.baseModuleID ?? null,
			metadata: this.getMetadata(wrapper),
			version: null
		};
		/* v8 ignore stop */
	}

	/**
	 * Resolve the wrapper of the API function that called the current function.
	 *
	 * The single resolution behind {@link Metadata#caller}: reads `callerWrapper` from the active
	 * context-manager store. `self.slothlet.pin.caller()` pins exactly this identity, so the
	 * two can never disagree about who "the caller" is.
	 *
	 * @returns {object|null} The calling function's wrapper, or null when there is no module caller
	 *   in context (the function was invoked from the host or outside the API).
	 * @public
	 */
	callerWrapper() {
		// The caller of the executing call as resolved for this instance, not the store's shared caller
		// field: that is restored in settle order, so once calls overlap it can name another call's
		// caller (#591), and an unscoped read can land on another instance's store (#592).
		const identity = this.slothlet.contextManager?.getCallerIdentity?.(this.slothlet.instanceID);
		return identity?.callerWrapper ?? null;
	}
}
