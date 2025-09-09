export namespace functions {
    /**
     * Central doclet processing function that organizes all doclets for consistent use
     * across TOC and content generation functions
     * @param {Array} doclets - All JSDoc doclets
     * @param {string} baseModuleLongname - The base module name
     * @returns {Object} Processed data structure with items in JSDoc order
     */
    function getPreferredName(doclet: any): any;
    function processDoclet(doclet: any): any;
    function applyNormalize(doclet: any): any;
    function applySimpleName(doclet: any): any;
    function applyAnchor(doclet: any): any;
    function processDoclets(doclets: any, baseModuleLongname: any): {
        items: {
            [x: string]: {
                type: string;
                doclet: any;
                children: {};
            };
        };
        constants: any[];
        typedefs: any[];
        anchorMap: Map<any, any>;
        globalTypedefs: any[];
        baseModuleLongname: string;
        baseModuleName: string;
    } | {
        items: {};
        constants: any[];
        typedefs: any[];
        globalTypedefs: any[];
        anchors: Map<any, any>;
        baseModule: any;
        baseModuleLongname: string;
        baseModuleName: string;
    };
    function detectCodeLanguage(doclet: any): "js" | "ts" | "jsx" | "tsx" | "json" | "markdown" | "html" | "css" | "scss" | "python" | "bash" | "yaml" | "xml";
    /**
     * Detect parent-child relationships in module names
     * @param {string} childModule - Potential child module name
     * @param {string} parentModule - Potential parent module name
     * @returns {boolean} True if childModule is a child of parentModule
     */
    function isChildModule(childModule: string, parentModule: string): boolean;
    /**
     * Determine if typedefs should be shared between child and parent modules
     * @param {string} childModule - Child module name
     * @param {string} parentModule - Parent module name
     * @returns {boolean} True if typedefs should be shared
     */
    function shouldShareTypedefs(childModule: string, parentModule: string): boolean;
    function sortHierarchyItems(hierarchyEntries: any): any;
    function buildSharedHierarchy(doclets: any, baseModuleLongname: any): Map<any, any>;
    /**
     * Creates a missing namespace doclet for auto-generation when namespace exists but has no doclet.
     * Similar to missingRootModule but for intermediate namespaces.
     * @param {string} namespaceName - Full namespace path (e.g., "api_test_mixed.advanced")
     * @param {string} baseModuleName - Base module name (e.g., "api_test_mixed")
     * @returns {object} Auto-generated namespace doclet
     */
    function missingNamespace(namespaceName: string, baseModuleName: string): object;
    function getParentDoclet(normalizedMemberof: any): any;
}
export namespace helper {
    function eq(a: any, b: any): boolean;
    function and(a: any, b: any): any;
    function or(a: any, b: any): any;
    function not(a: any): boolean;
    function gt(a: any, b: any): boolean;
    function concat(...args: any[]): string;
    function hasRootModule(doclets: any): any;
    function nameWithDot(name: any): string;
    function shouldInclude(doclet: any): any;
    function displayName(name: any): string;
    function startsWith(str: any, prefix: any): boolean;
    function hasNamespaces(moduleDoc: any, options: any): boolean;
    function escapeHtml(str: any): string;
    function length(obj: any): number;
    function debugFunction(doc: any, namespaceLongname: any): any;
    function debug(_: any): string;
}
//# sourceMappingURL=helpers.d.cts.map