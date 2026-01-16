/**
 * @fileoverview Runtime dispatcher - automatically selects async or live runtime based on context
 * @module @cldmv/slothlet/runtime
 * @public
 */

// For now, default to async runtime
// In the future, this could auto-detect based on execution context
export * from "@cldmv/slothlet/runtime/async";
