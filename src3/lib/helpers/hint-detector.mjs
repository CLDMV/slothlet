/**
 * @fileoverview Hint detection system for providing helpful error hints
 * @module @cldmv/slothlet/helpers/hint-detector
 */

/**
 * Hint detection rules - pattern matching for common errors
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
	if (!error) {
		return undefined;
	}

	const errorMessage = error.message || error.toString();

	// Check each rule
	for (const rule of HINT_RULES) {
		if (rule.pattern.test(errorMessage)) {
			return rule.hintKey;
		}
	}

	// No hint found
	return undefined;
}
