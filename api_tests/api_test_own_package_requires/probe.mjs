/**
 * @fileoverview Runs the own-package require fixture (#715) under Node's own loader and prints what every case gave as
 * JSON.
 * @module api_test_own_package_requires.probe
 */

const { default: slothlet } = await import("@cldmv/slothlet");
const { runCalls } = await import("./calls.mjs");
console.log(JSON.stringify(await runCalls(slothlet)));
