/**
 * Base class for Slothlet component classes.
 * @class ComponentBase
 * @package
 *
 * @description
 * Provides common Slothlet property access for handlers, builders, and processors.
 * All component classes should extend this to gain consistent access to the Slothlet
 * instance's configuration, API references, and error classes. Components are instantiated
 * with a reference to the Slothlet class itself, making them modular extensions.
 *
 * @example
 * class ApiManager extends ComponentBase {
 *   constructor(slothlet) {
 *     super(slothlet);
 *     this.state = { addHistory: [] };
 *   }
 *
 *   someMethod() {
 *     if (this.debug?.api) {
 *       console.log(`Slothlet: ${this.instanceID}`);
 *     }
 *     throw new this.SlothletError("INVALID_CONFIG", { reason: "bad input" });
 *   }
 * }
 */
export class ComponentBase {
    /**
     * Complete set of property names reserved by the slothlet framework.
     *
     * @description
     * These keys are either private wrapper internals, read-only info props exposed
     * through the proxy, write-blocked lifecycle keys, or builtin namespace keys
     * injected at the API root level. Used by all components to distinguish framework
     * internals from user-defined properties when:
     *   - Collecting user-set custom properties for preservation across reload
     *     (`_collectCustomProperties` in api-manager.mjs)
     *   - Extracting child keys for impl reconstruction (`_extractFullImpl`)
     *   - Determining whether a set(trap) write should be silently absorbed (`setTrap`)
     *   - Filtering what getTrap exposes externally on wrapper proxies
     *
     * Note: `_materialize` is included here (skip for collection/extraction) but
     * setTrap exempts it since the framework needs to write it directly.
     *
     * @type {Set<string>}
     * @static
     */
    static INTERNAL_KEYS: Set<string>;
    /**
     * Create a component base instance.
     * @param {object} slothlet - Slothlet class instance.
     * @package
     *
     * @description
     * Stores the Slothlet reference for access via getters. The Slothlet class itself
     * is passed (not a separate "instance" object), making components modular extensions
     * of Slothlet.
     *
     * @example
     * super(slothlet);
     */
    constructor(slothlet: object);
    /**
     * Get Slothlet instance via the canonical internal accessor name.
     * @returns {object} Slothlet instance.
     * @package
     *
     * @description
     * Prototype getter — NOT an own property — so the JS Proxy invariant for
     * non-configurable own properties never applies. UnifiedWrapper's getTrap blocks
     * this name via the underscore-filter before it can reach the getter.
     *
     * @example
     * const s = this.____slothlet;
     */
    get ____slothlet(): object;
    /**
     * Get Slothlet instance (internal access).
     * @returns {object} Slothlet instance.
     * @package
     *
     * @description
     * Provides direct access to the Slothlet instance for legacy code compatibility.
     * Prefer using specific getters (config, helpers, handlers) when possible.
     *
     * @example
     * this.slothlet.debug("api", { action: "assigned" });
     */
    get slothlet(): object;
    /**
     * Get Slothlet configuration.
     * @returns {object} Slothlet configuration object.
     * @package
     *
     * @description
     * Provides access to the Slothlet config for collision modes, debug settings, etc.
     * Named with ____ prefix to avoid shadowing user API names like 'config'.
     *
     * @example
     * const collisionMode = this.____config.collision.api;
     */
    get ____config(): object;
    /**
     * Get Slothlet instance ID.
     * @returns {string} Slothlet instance identifier.
     * @package
     */
    get instanceID(): string;
    /**
     * Get SlothletError class.
     * @returns {Function} SlothletError constructor.
     * @package
     *
     * @description
     * Provides access to SlothletError without importing in every file.
     * Components can throw errors via `new this.SlothletError(...)`.
     *
     * @example
     * throw new this.SlothletError("INVALID_CONFIG", { reason: "missing dir" });
     */
    get SlothletError(): Function;
    /**
     * Get SlothletWarning class.
     * @returns {Function} SlothletWarning constructor.
     * @package
     *
     * @description
     * Provides access to SlothletWarning without importing in every file.
     * Components can issue warnings via `new this.SlothletWarning(...)`.
     *
     * @example
     * new this.SlothletWarning("WARNING_DEPRECATED", { feature: "oldApi" });
     */
    get SlothletWarning(): Function;
    /**
     * Emit a non-throwing diagnostic lifecycle event (`impl:warning` or `impl:error`).
     * @param {"warning"|"error"} level - Diagnostic level → `impl:warning` or `impl:error`.
     * @param {object} data - Diagnostic payload.
     * @param {string} data.code - i18n code (e.g. "WARN_SYNTHETIC_ROOT_COLLISION") used to translate `message`.
     * @param {object} data.context - Structured context object passed to the diagnostic (also the i18n interpolation params).
     * @param {string} [data.apiPath] - API path where the mutation was attempted ("" / "(root)" for root).
     * @param {string} [data.source] - Command family that produced the diagnostic (addApi | reload | buildAPI | module-mount).
     * @param {string} [data.moduleID] - Module identifier, when one is in scope.
     * @param {Error} [data.error] - The originating Error / SlothletError (impl:error only).
     * @returns {Promise<void>} Resolves once all subscribers (including async ones) have run.
     * @package
     *
     * @description
     * Fires an additive lifecycle event for a diagnostic the framework handled WITHOUT throwing —
     * a warning, or a runtime error a command caught and continued past. Observers registered via
     * `api.slothlet.lifecycle.on("impl:warning"|"impl:error", fn)` — or the construction-time
     * `lifecycle` config option — receive these regardless of the `silent` config: `silent`
     * suppresses console output only, never events. The human-readable `message` is translated
     * from `code` + `context` here so subscribers get a ready-to-display string even when the
     * corresponding SlothletWarning/SlothletError was never constructed (e.g. under `silent`).
     *
     * Emission stays per-site: each diagnostic location calls this explicitly, mirroring how each
     * site constructs its own `this.SlothletWarning`. The SlothletError / SlothletWarning classes
     * remain context-free (no slothlet reference) and are never coupled to the lifecycle emitter.
     *
     * @example
     * await this.emitImplDiagnostic("warning", {
     *   apiPath: "", code: "WARN_SYNTHETIC_ROOT_EMPTY", context: { apiPath: "(root)" }, source: "addApi"
     * });
     */
    emitImplDiagnostic(level: "warning" | "error", data: {
        code: string;
        context: object;
        apiPath?: string | undefined;
        source?: string | undefined;
        moduleID?: string | undefined;
        error?: Error | undefined;
    }): Promise<void>;
    /**
     * Emit the public `impl:collision` lifecycle event (#441).
     * @param {object} data - Collision payload (every field is passed explicitly by the call site).
     * @param {string} data.apiPath - Dot-notation api path where the collision resolved.
     * @param {"dropped"|"replaced"|"merged"|"stacked"} data.resolution - What became of the two
     *   writers: `dropped` (incoming discarded, `owner` retained), `replaced` (incoming won, `owner`
     *   shadowed), `merged` (namespace nodes combined, both retained), `stacked` (both run as a
     *   routine stack under `stackRoutines`).
     * @param {string|null} data.incoming - moduleID of the arriving writer (`null` when unknown).
     * @param {string|null} data.owner - moduleID of the writer that already held the path (`null`
     *   when unknown).
     * @param {"value"|"namespace"} data.kind - Whether the colliding contribution is a value leaf
     *   or a namespace node.
     * @param {string|null} data.collisionMode - The mode that resolved it (`skip`/`warn`/`replace`/
     *   `merge`/`merge-replace`), or `null` where a mode is not meaningful (e.g. `stacked`).
     * @returns {void}
     * @package
     *
     * @description
     * Unlike `impl:created` — which fires post-placement for the path WINNER only, so a leaf a merge
     * discards is never announced — `impl:collision` fires for the collision itself and carries BOTH
     * writers, so a consumer can observe a silently dropped or shadowed leaf regardless of nesting.
     *
     * Fire-and-forget by design: `emit()` isolates each handler's errors and never rejects (mirroring
     * the `impl:created` re-emit in `src/slothlet.mjs`), so a collision-decision site can announce the
     * event without awaiting subscriber code inline and without any unhandled rejection escaping.
     * Synchronous subscribers still run during this call (before `emit()` yields), so an observer that
     * collects events sees them by the time the composing `await` resolves.
     *
     * @example
     * this.emitImplCollision({
     *   apiPath: "shared.alpha", resolution: "dropped", incoming: "pkgB_x", owner: "pkgA_y",
     *   kind: "value", collisionMode: "merge"
     * });
     */
    emitImplCollision({ apiPath, resolution, incoming, owner, kind, collisionMode }: {
        apiPath: string;
        resolution: "dropped" | "replaced" | "merged" | "stacked";
        incoming: string | null;
        owner: string | null;
        kind: "value" | "namespace";
        collisionMode: string | null;
    }): void;
    #private;
}
//# sourceMappingURL=component-base.d.mts.map