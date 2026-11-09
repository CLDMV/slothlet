/**
 * @fileoverview An ES module helper of the module's own package (#715): the `.cjs` leaf requires it by a relative path,
 * by the package's `#h` import and by the package's own name, and the ES module leaf imports it by `#h`. Each evaluation
 * records the URL it ran under and the identity object it created, so the fixture can tell one module record from two.
 * @module api_test_own_package_requires.pkg.lib.h
 */

const evaluations = (globalThis.__ownPackageRequires ??= { h: [], c: [] });

/** This evaluation's identity: the same object through every spelling that reaches one module record. */
export const identity = {};

evaluations.h.push({ url: import.meta.url, identity });
