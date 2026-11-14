/**
 * @fileoverview Data with more object members than slothlet keeps per-path permission records for, so serializing it
 * under rules on its members runs past them.
 * @module api_test_api_node_default_data/bulk
 */

/**
 * 1,100 object members, `m0` to `m1099`, each holding its index as `v`.
 * @type {Record<string, {v: number}>}
 */
export const many = Object.fromEntries(Array.from({ length: 1100 }, (_, index) => [`m${index}`, { v: index }]));
