/**
 * @fileoverview Fixture: a module allowed to read the vault. It imports no helper file.
 * @module api_test_import_record.trusted
 * @memberof module:api_test_import_record
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Read the vault.
 * @function read
 * @memberof module:api_test_import_record.trusted
 * @returns {string} What the vault holds.
 * @example
 * api.trusted.read(); // "SECRET"
 */
export const read = () => self.vault.get();
