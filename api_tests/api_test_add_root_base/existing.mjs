/**
 * @fileoverview Base root-level key used to reproduce a root add() call where one key
 * collides under "skip" and another key is brand new, verifying per-key ownership
 * gating rather than an aggregate any-key-succeeded flag.
 * @module api_tests/api_test_add_root_base
 */

/**
 * Base implementation of the "existing" root key.
 * @param {string} x - Input value.
 * @returns {string} Tagged value.
 */
export function existing(x) {
	return `root-base:${x}`;
}
