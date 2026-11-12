/**
 * @fileoverview Fixture: a helper file only `guest.mjs` imports. Its function reads the vault and keeps the answer.
 * @module api_test_import_record.helpers.reader
 */
import { self } from "@cldmv/slothlet/runtime";

let answer = "nothing";

/**
 * Read the vault and keep what it gave, or the code of the refusal.
 * @returns {void}
 * @example
 * read();
 */
export const read = () => {
	try {
		answer = self.vault.get();
	} catch (error) {
		answer = error.code ?? String(error);
	}
};

/**
 * What the last read gave.
 * @returns {string} The answer.
 * @example
 * last(); // "SECRET"
 */
export const last = () => answer;

/**
 * Forget the last answer.
 * @returns {void}
 * @example
 * reset();
 */
export const reset = () => {
	answer = "nothing";
};
