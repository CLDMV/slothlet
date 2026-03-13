/**
 * Flattening decision processor
 * @class Flatten
 * @extends ComponentBase
 * @package
 */
export class Flatten extends ComponentBase {
    static slothletProperty: string;
    /**
     * Core flattening decision function.
     * Implements conditions C01-C07 from getFlatteningDecision().
     * @param {object} options - Decision options
     * @param {object} options.mod - Module exports
     * @param {string} options.moduleName - Sanitized module name
     * @param {string} options.categoryName - Category/folder name
     * @param {object} options.analysis - Export analysis
     * @param {boolean} options.hasMultipleDefaults - Multiple defaults in folder
     * @param {array} options.moduleKeys - Keys from module
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
        moduleKeys: any[];
        t: Function;
    }): Promise<object>;
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
     * @returns {{ moduleContent: object|Function }} Built module content ready for wrapping/assignment.
     * @public
     */
    public processModuleForAPI(options: {
        mod: object;
        decision: object;
        moduleName: string;
        propertyName: string;
        moduleKeys: string[];
        analysis: object;
        file?: object;
        collisionContext?: string;
        apiPathPrefix?: string;
    }): {
        moduleContent: object | Function;
    };
    /**
     * Build category-level flattening decisions.
     * Implements conditions C10-C33 from buildCategoryDecisions().
     * @param {object} options - Category options
     * @param {string} options.categoryName - Category name
     * @param {object} options.mod - Module exports
     * @param {string} options.moduleName - Module name
     * @param {string} options.fileBaseName - File base name
     * @param {object} options.analysis - Export analysis
     * @param {array} options.moduleKeys - Module keys
     * @param {number} options.currentDepth - Current depth
     * @param {array} options.moduleFiles - Files in category
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
        moduleKeys: any[];
        currentDepth: number;
        moduleFiles: any[];
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
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=flatten.d.mts.map