/**
 * @fileoverview Fixture: the module one rule set denies `guest`.
 * @module api_test_import_record.vault
 * @memberof module:api_test_import_record
 */

/**
 * What the vault holds.
 * @function get
 * @memberof module:api_test_import_record.vault
 * @returns {string} "SECRET".
 * @example
 * api.vault.get(); // "SECRET"
 */
export const get = () => "SECRET";
