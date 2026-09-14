/**
 * Fixture for #366/#372 ownership-revert coverage: second no-default file in the
 * `notifications` multi-default folder — see helperA.mjs's own doc comment. Its `shared`
 * export names the SAME hoisted key as helperA.mjs's, so within this one build one of the
 * two always collides with the other's already-registered ownership entry.
 */

export const shared = "helperB-value";
