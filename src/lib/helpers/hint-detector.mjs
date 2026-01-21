/**
 * @fileoverview Hint detection system for providing helpful error hints
 * @module @cldmv/slothlet/helpers/hint-detector
 */

/**
 * Hint detection rules - pattern matching for originalError messages
 * @private
 */
const HINT_RULES = [
	{
		pattern: /does not provide an export named 'reference'/i,
		hintKey: "HINT_REFERENCE_REMOVED"
	},
	{
		pattern: /Cannot find module/i,
		hintKey: "HINT_MODULE_NOT_FOUND"
	},
	{
		pattern: /Unexpected token/i,
		hintKey: "HINT_SYNTAX_ERROR"
	}
];

/**
 * Detect appropriate hint key based on error
 * @param {Error} error - The original error
 * @param {string} errorCode - The SlothletError code
 * @returns {string|undefined} Hint key for i18n translation, or undefined
 * @public
 */
export function detectHint(error, errorCode) {
	// If we have an originalError, check pattern rules first
	if (error) {
		const errorMessage = error.message || error.toString();
		for (const rule of HINT_RULES) {
			if (rule.pattern.test(errorMessage)) {
				return rule.hintKey;
			}
		}
	}

	// Convention: CONTEXT_NOT_FOUND → HINT_CONTEXT_NOT_FOUND
	// Returns hint key even if it doesn't exist in translations (error system will check)
	return `HINT_${errorCode}`;
}
