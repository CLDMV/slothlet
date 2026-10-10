/**
 * Flattening decision processor
 * @class Flatten
 * @extends ComponentBase
 * @package
 */
export class Flatten extends ComponentBase {
    static slothletProperty: string;
    /**
     * Create a Flatten instance
     * @param {Object} slothlet - Slothlet instance
     */
    constructor(slothlet: Object);
    /**
     * Core flattening decision function.
     * Implements conditions C01-C07 from getFlatteningDecision().
     * @param {object} options - Decision options
     * @param {object} options.mod - Module exports
     * @param {string} options.moduleName - Sanitized module name
     * @param {string} options.categoryName - Category/folder name
     * @param {object} options.analysis - Export analysis
     * @param {boolean} options.hasMultipleDefaults - Multiple defaults in folder
     * @param {string[]} options.moduleKeys - Keys from module
     * @param {function} options.t - Translation function
     * @returns {Promise<object>} Flattening decision
     * @public
     */
    public getFlatteningDecision(options: {
        mod: object;
        moduleName: string;
        categoryName: string;
        analysis: object;
        hasMultipleDefaults: boolean;
        moduleKeys: string[];
        t: Function;
    }): Promise<object>;
    /**
     * The version of a module's object default its named exports are merged onto, so the module's own
     * export is never changed: a plain object is copied (prototype and descriptors kept, every member
     * replaceable), and a Proxy, class instance, built-in or array gets a layer that holds the named
     * exports and answers everything else from the default itself. See
     * {@link module:@cldmv/slothlet/helpers/composition.copyForComposition}.
     * @param {object} value - The module's object default.
     * @returns {object} The copy, or the layer over the default.
     * @public
     *
     * @example
     * const moduleContent = flatten.cloneDefault(mod.default);
     */
    public cloneDefault(value: object): object;
    /**
     * The value a function default's named exports are composed onto: the function itself, or a callable
     * layer when it is a Proxy, so its traps keep answering and nothing is written through them.
     * @param {Function} fn - The module's function default.
     * @returns {Function} The function, or the layer over the Proxy.
     * @public
     *
     * @example
     * const moduleContent = flatten.composeFunctionDefault(mod.default);
     */
    public composeFunctionDefault(fn: Function): Function;
    /**
     * The namespace a primitive default and its named exports compose into: a primitive holds no
     * members, so it is kept under `default` beside them, as the plain-file rule composes it. Every
     * path that meets a primitive default with named exports builds it here (#585 review).
     * @param {unknown} value - The module's default export.
     * @param {object} mod - The module namespace.
     * @param {string[]} moduleKeys - The module's named export keys (without `default`).
     * @returns {object|null} The namespace, or `null` when `value` is not a primitive default or the module
     *   has no named exports.
     * @public
     *
     * @example
     * flatten.primitiveDefaultNamespace(3, { default: 3, label: "x" }, ["label"]); // { default: 3, label: "x" }
     */
    public primitiveDefaultNamespace(value: unknown, mod: object, moduleKeys: string[]): object | null;
    /**
     * See {@link module:@cldmv/slothlet/helpers/composition.relayer}.
     * @param {object} layered - A layer {@link Flatten#cloneDefault} returned, or a value to layer.
     * @param {Array<[PropertyKey, PropertyDescriptor]>} members - Members to start with, in order.
     * @returns {object} The new layer.
     * @public
     *
     * @example
     * const instance = flatten.relayer(impl, [["sib", { value: sib }]]);
     */
    public relayer(layered: object, members: Array<[PropertyKey, PropertyDescriptor]>): object;
    /**
     * Whether a module's default export has a member named `key`, so a same-named named export conflicts
     * with it. A member is an own property, enumerable or not, or one a prototype the module defines
     * provides (a class instance's methods and getters, a subclass constructor's inherited statics).
     * Object.prototype, Function.prototype and Array.prototype are the language's, not the module's, so
     * a named `toString` or `call` is not a conflict. Every path that combines a default with its named
     * exports asks this one question, so the outcome does not depend on the path.
     * @param {unknown} value - The module's default export.
     * @param {string} key - The named export's key.
     * @returns {boolean} True when the default has that member.
     * @public
     *
     * @example
     * flatten.defaultHasMember(new (class { add() {} })(), "add"); // true
     * flatten.defaultHasMember({}, "toString"); // false
     */
    public defaultHasMember(value: unknown, key: string): boolean;
    /**
     * Put a named export on the composed default under `key`. A writable data member takes it by
     * assignment. Anything else is redefined as a data property: a read-only member (a non-writable own
     * property of the default) would throw, and an accessor, own or inherited, would run its setter, which
     * may transform or ignore the value, so the default's member would still answer.
     * @param {object|Function} target - The composed default (a copy, or a function default).
     * @param {string} key - The named export's key.
     * @param {unknown} value - The named export.
     * @returns {void}
     * @public
     *
     * @example
     * flatten.assignNamedExport(moduleContent, "secret", mod.secret);
     */
    public assignNamedExport(target: object | Function, key: string, value: unknown): void;
    /**
     * Resolve a conflict between a named export and the same-named own member of the module's default
     * export, by collision mode (#421): `merge` / `skip` keep the default's member, `error` throws,
     * `warn` warns and lets the named export overwrite, `replace` / `merge-replace` overwrite. Every path
     * that combines a module's default with its named exports resolves conflicts here, so the outcome
     * does not depend on which path composes the module (#587).
     * @param {string} key - The conflicting key.
     * @param {string|undefined} collisionMode - Effective collision mode.
     * @param {string} apiPath - Api path of the module, for the error / warning.
     * @returns {boolean} True when the named export overwrites the default's member.
     * @throws {SlothletError} COLLISION_DEFAULT_EXPORT_ERROR under `error`.
     * @public
     *
     * @example
     * if (conflicts && !flatten.namedExportWinsOverDefault(key, "merge", "math")) continue;
     */
    public namedExportWinsOverDefault(key: string, collisionMode: string | undefined, apiPath: string): boolean;
    /**
     * Build module content for API assignment.
     *
     * Canonical implementation of the C08-C09b content-building rules, including
     * AddApi detection and collision handling. Previously this logic was inlined
     * inside modes-processor.mjs; it now lives here so the processor stays focused
     * on wrapping and assignment concerns only.
     *
     * Collision config, modesUtils helpers, and SlothletWarning are accessed
     * directly through {@link this.slothlet} / {@link this.slothlet.config} — no caller
     * plumbing required.
     *
     * @param {object}   options                              - Processing options.
     * @param {object}   options.mod                         - Module exports.
     * @param {object}   options.decision                    - Flattening decision from getFlatteningDecision.
     * @param {string}   options.moduleName                  - Sanitized module name (used for C08 auto-flatten key lookup).
     * @param {string}   options.propertyName                - Resolved preferred name (decision.preferredName || moduleName).
     * @param {string[]} options.moduleKeys                  - Named export keys (excluding "default").
     * @param {object}   options.analysis                    - { hasDefault, hasNamed, defaultExportType }.
     * @param {object}   [options.file=null]                 - File descriptor for AddApi detection via file.name / file.fullName.
     * @param {string}   [options.collisionContext="initial"] - Collision context ("initial" | "api").
     * @param {string}   [options.apiPathPrefix=""]          - API path prefix for collision error messages.
     * @param {string|null} [options.collisionModeOverride=null] - Caller's per-call override (e.g.
     *   `api.add({ forceOverwrite: true })`), preferred over `collisionContext`'s config default for
     *   the function-default-vs-named-export merge decision below.
     * @returns {{ moduleContent: object|Function, origins: {self: (string[]|null), members: Object<string, string[]>} }}
     *   Built module content ready for wrapping/assignment, plus where it came from (#484): `self` is the
     *   content's own exportPath when it IS one export (`["default"]`, `["add"]`), `null` when it is a
     *   fresh object composed here; `members` maps each key this step placed onto the content to the
     *   exportPath it was read from. Keys the content already carried (a default object's own members)
     *   are not listed — they are located under `self`.
     * @public
     */
    public processModuleForAPI(options: {
        mod: object;
        decision: object;
        moduleName: string;
        propertyName: string;
        moduleKeys: string[];
        analysis: object;
        file?: object | undefined;
        collisionContext?: string | undefined;
        apiPathPrefix?: string | undefined;
        collisionModeOverride?: string | null | undefined;
    }): {
        moduleContent: object | Function;
        origins: {
            self: (string[] | null);
            members: {
                [x: string]: string[];
            };
        };
    };
    /**
     * Build category-level flattening decisions.
     * Implements conditions C10-C24 from buildCategoryDecisions().
     * @param {object} options - Category options
     * @param {string} options.categoryName - Category name
     * @param {object} options.mod - Module exports
     * @param {string} options.moduleName - Module name
     * @param {string} options.fileBaseName - File base name
     * @param {object} options.analysis - Export analysis
     * @param {string[]} options.moduleKeys - Module keys
     * @param {number} options.currentDepth - Current depth
     * @param {unknown[]} options.moduleFiles - Files in category
     * @param {function} options.t - Translation function
     * @returns {Promise<object>} Category decision
     * @public
     */
    public buildCategoryDecisions(options: {
        categoryName: string;
        mod: object;
        moduleName: string;
        fileBaseName: string;
        analysis: object;
        moduleKeys: string[];
        currentDepth: number;
        moduleFiles: unknown[];
        t: Function;
    }): Promise<object>;
    /**
     * Decide whether a named export should be attached to a callable default export.
     *
     * Returns false when the named export is the same reference as the default (re-export
     * pattern), or when the export key matches the function name (self-referential export).
     *
     * @param {string} key - Named export key.
     * @param {unknown} value - Named export value.
     * @param {Function} defaultFunc - Wrapped callable default export.
     * @param {Function} originalDefault - Original default export.
     * @returns {boolean} True if the export should be attached.
     * @public
     */
    public shouldAttachNamedExport(key: string, value: unknown, defaultFunc: Function, originalDefault: Function): boolean;
    #private;
}
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=flatten.d.mts.map