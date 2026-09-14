/**
 * Fixture for #366 ownership-revert coverage on the addApi/category-merge path (Rule 11 /
 * C33): a default-export-only `addapi.mjs` (no other named exports) merges its object
 * default's own keys directly into the `plugins` category namespace.
 *
 * `constructor` collides with the `plugins` namespace wrapper's own inherited
 * `Object.prototype.constructor` (see helperA.mjs's doc comment for the identical
 * mechanism) — always rejected under `collision: "skip"`, exercising the
 * `modes_addapiOneAssigned` false arm. `greeting` has no such collision and succeeds.
 */

export default {
	constructor: "not-a-function",
	greeting: "hello"
};
