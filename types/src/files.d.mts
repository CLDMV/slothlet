/**
 * The `@cldmv/slothlet/files` namespace.
 * @type {{
 *   assets: typeof assets,
 *   generate: typeof generate,
 *   importmap: typeof importmap,
 *   resolver: typeof createManifestResolver,
 *   specifiers: { packages: typeof packageSpecifiers, slothlet: typeof slothletSpecifiers }
 * }}
 * @public
 */
export const files: {
    assets: typeof assets;
    generate: typeof generate;
    importmap: typeof importmap;
    resolver: typeof createManifestResolver;
    specifiers: {
        packages: typeof packageSpecifiers;
        slothlet: typeof slothletSpecifiers;
    };
};
/**
 * The file list and the full importmap (slothlet's own modules and the packages the api files import). Node only.
 * @param {string} dir - The api folder.
 * @param {object} [options] - Options.
 * @param {string} [options.base="/node_modules/@cldmv/slothlet/"] - Where the page is served `@cldmv/slothlet` from.
 * @returns {Promise<{ manifest: { files: Array, directories: Array }, importmap: { imports: Object<string,string>, scopes: Object<string, Object<string,string>> } }>}
 *   The file list and the importmap.
 * @public
 */
declare function assets(dir: string, options?: {
    base?: string | undefined;
}): Promise<{
    manifest: {
        files: any[];
        directories: any[];
    };
    importmap: {
        imports: {
            [x: string]: string;
        };
        scopes: {
            [x: string]: {
                [x: string]: string;
            };
        };
    };
}>;
/**
 * List an api folder: the file list `slothlet()` loads from in a browser. Node only.
 * @param {string} dir - The api folder.
 * @returns {Promise<{ files: Array, directories: Array }>} The file list.
 * @public
 */
declare function generate(dir: string): Promise<{
    files: any[];
    directories: any[];
}>;
/**
 * The importmap for slothlet's own modules, served from `base`. Node only.
 * @param {string} [base="/node_modules/@cldmv/slothlet/"] - Where the page is served `@cldmv/slothlet` from.
 * @returns {Promise<{ imports: Object<string,string>, scopes: Object<string, Object<string,string>> }>} The importmap.
 * @public
 */
declare function importmap(base?: string): Promise<{
    imports: {
        [x: string]: string;
    };
    scopes: {
        [x: string]: {
            [x: string]: string;
        };
    };
}>;
import { createManifestResolver } from "#helpers/manifest-resolver";
/**
 * The importmap entries of any package, from its `exports`. Node only.
 * @param {string} root - The package's folder.
 * @returns {Promise<Map<string,string>>} Specifier to path inside the package.
 * @public
 */
declare function packageSpecifiers(root: string): Promise<Map<string, string>>;
/**
 * The specifiers of slothlet's own the importmap maps. Node only.
 * @param {string} root - The `@cldmv/slothlet` package folder.
 * @returns {Promise<Set<string>>} The specifiers.
 * @public
 */
declare function slothletSpecifiers(root: string): Promise<Set<string>>;
export {};
//# sourceMappingURL=files.d.mts.map