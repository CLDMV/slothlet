/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_import_record/helpers/reader.mjs
 *	@Date: 2026-11-12T01:13:22-08:00 (1794474802)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:35-08:00 (1794477395)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

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
