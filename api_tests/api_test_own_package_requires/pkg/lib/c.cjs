/**
 * @fileoverview A CommonJS helper of the module's own package (#715): the `.cjs` leaf requires it by a relative path,
 * by the package's `#c` import and by the package's own name, and the ES module leaf imports it by `#c`. Each evaluation
 * records the file it ran from and the identity object it created.
 * @module api_test_own_package_requires.pkg.lib.c
 */

const evaluations = (globalThis.__ownPackageRequires ??= { h: [], c: [] });

/** This evaluation's identity: the same object through every spelling that reaches one copy. */
const identity = {};

evaluations.c.push({ url: __filename, identity });

module.exports = { identity };
