export function normalizeContext(ctx: any): any;
export function installGlobalsInCurrentRealm(contextMap: any): void;
export function extendSelfWithReference(self: any, reference: any): void;
export function installPortalForSelf(): void;
export function asUrl(p: any): any;
export function isPlainObject(o: any): boolean;
export function guessName(v: any): any;
export function makeNodeishContext(): vm.Context;
/**
 * Loads a module into a VM context, supporting ESM (mjs), CJS (cjs), or auto-detection.
 * @param {object} context - The VM context.
 * @param {string} fileUrl - The file URL to load.
 * @param {string} [mode='auto'] - 'auto', 'mjs', or 'cjs'.
 * @returns {Promise<object>} Module namespace or SourceTextModule.
 */
export function loadEsmInVm2(context: object, fileUrl: string, mode?: string, ...args: any[]): Promise<object>;
export function loadEsmInVm(context: any, fileUrl: any): Promise<any>;
export function installContextGlobalsVM(context: any, userContext: any): void;
export function bootSlothletVM(context: any, entryUrl: any, loadConfig: any, ctxRef: any): Promise<void>;
export function marshalArgsReplaceFunctions(value: any, registerCb: any): any;
export function reviveArgsReplaceTokens(value: any, invokeCb: any): any;
export function containsFunction(value: any): boolean;
export const HAS_STM: boolean;
import vm from "node:vm";
