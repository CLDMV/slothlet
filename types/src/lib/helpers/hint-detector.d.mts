/**
 * Hint detection for providing helpful error hints
 * @class HintDetector
 * @extends ComponentBase
 * @package
 */
export class HintDetector extends ComponentBase {
    static slothletProperty: string;
    /**
     * Detect appropriate hint key based on error
     * @param {Error} error - The original error
     * @param {string} errorCode - The SlothletError code
     * @returns {string|undefined} Hint key for i18n translation, or undefined
     * @public
     */
    public detectHint(error: Error, errorCode: string): string | undefined;
}
/**
 * Detect appropriate hint key based on error
 * @param {Error} error - The original error
 * @param {string} errorCode - The SlothletError code
 * @returns {string|undefined} Hint key for i18n translation, or undefined
 * @public
 */
export function detectHint(error: Error, errorCode: string): string | undefined;
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=hint-detector.d.mts.map