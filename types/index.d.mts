export default slothlet;
/**
 * The framework surface of a composed api: `api.slothlet.*`, `api.shutdown()`, `api.destroy()`.
 * `slothlet typegen` output extends `SlothletSelf` with it, so `self.slothlet.*` is typed too.
 */
export type SlothletAPI = import("./src/slothlet.mjs").SlothletAPI;
/**
 * The framework surface of a composed api: `api.slothlet.*`, `api.shutdown()`, `api.destroy()`.
 * `slothlet typegen` output extends `SlothletSelf` with it, so `self.slothlet.*` is typed too.
 * @typedef {import("./src/slothlet.mjs").SlothletAPI} SlothletAPI
 */
/**
 * Creates a slothlet API instance with live-binding context and AsyncLocalStorage support.
 * Automatically wraps all API functions with context isolation for multi-instance support.
 *
 * The resolved api is typed as `SlothletAPI & T`. `T` defaults to `SlothletSelf` from
 * `@cldmv/slothlet/runtime`, which a `slothlet typegen` declaration extends with the project's api —
 * so a project with generated types gets a typed api with no annotation. A program that loads more
 * than one api passes the interface explicitly: `slothlet<OtherApi>({ base: "./other" })`.
 * @public
 * @async
 *
 * @template {object} [T=import("./src/lib/runtime/runtime.mjs").SlothletSelf]
 * @param {import("./src/slothlet.mjs").SlothletOptions} [options={}] - Configuration options for the slothlet instance. See {@link SlothletOptions} for the full set.
 * @returns {Promise<import("./src/slothlet.mjs").SlothletAPI & T>} The bound API object with management methods
 *
 * @example // ESM
 * import slothlet from "@cldmv/slothlet";
 * const api = await slothlet({ base: './api', mode: 'lazy' });
 * const result = await api.math.add(2, 3); // 5
 *
 */
export function slothlet<T extends object = import("./src/lib/runtime/runtime.mjs").SlothletSelf>(options?: import("./src/slothlet.mjs").SlothletOptions): Promise<import("./src/slothlet.mjs").SlothletAPI & T>;
export namespace slothlet {
    export let defaults: Readonly<{
        routines: readonly (Readonly<{
            name: "initialize";
            mode: "startup";
        }> | Readonly<{
            name: "shutdown";
            mode: "shutdown";
        }>)[];
        reservedExports: any;
    }>;
    export { slothlet };
}
//# sourceMappingURL=index.d.mts.map