#!/usr/bin/env node
/**
 * Analyze all files in the src directory
 * @returns {Promise<object[]>} Array of analysis results
 */
export function analyzeCodebase(): Promise<object[]>;
/**
 * Generate audit report
 * @param {object[]} analyses - Array of file analyses
 * @returns {object} Comprehensive audit report
 */
export function generateAuditReport(analyses: object[]): object;
//# sourceMappingURL=function-analyzer.d.mts.map