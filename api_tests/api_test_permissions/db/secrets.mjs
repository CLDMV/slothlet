/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/db/secrets.mjs
 *	@Date: 2026-05-18 12:00:00 -07:00 (1779130800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-18 12:00:00 -07:00 (1779130800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

// Terminal data values exported on a module API path. Without permissions.readGating
// these are readable by any module via `self.db.secrets.*` regardless of deny rules.
// The set covers every branch of the read-gate's terminal-value classifier.
export const token = Buffer.from("super-secret-token", "utf8"); // Buffer (TypedArray view)
export const bytes = new Uint8Array([1, 2, 3, 4]); // TypedArray view
export const rawBuffer = new ArrayBuffer(8); // ArrayBuffer
export const issued = new Date("2026-01-01T00:00:00Z"); // Date
export const lookup = new Map([["region", "us"]]); // Map
export const memberSet = new Set([1, 2, 3]); // Set
export const weakLookup = new WeakMap(); // WeakMap
export const weakMembers = new WeakSet(); // WeakSet
export const pattern = /classified-\d+/u; // RegExp
export const pending = Promise.resolve("ok"); // Promise
export const failure = new Error("sealed"); // Error

// Primitive data values — every primitive value type.
export const label = "classified"; // string
export const count = 42; // number
export const active = true; // boolean
export const ledgerId = 9007199254740993n; // bigint
export const marker = Symbol("secret"); // symbol
export const missing = null; // null

// Self-call: reads a data value exported from this same source file.
// Must always be allowed via the self-call bypass, even under deny rules.
export const readOwnToken = () => self.db.secrets.token;
