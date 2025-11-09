#!/usr/bin/env node
/**
 * Analyze differences between index.mjs and index.cjs
 * @returns {Promise<object>} Analysis results
 */
export function analyzeEntryPoints(): Promise<object>;
/**
 * Generate a consolidated index.cjs using requireESM pattern
 * @param {object} _ - Analysis results (unused for generation)
 * @returns {string} Generated CJS content
 */
export function generateConsolidatedCJS(_: object): string;
//# sourceMappingURL=entry-point-analyzer.d.mts.map