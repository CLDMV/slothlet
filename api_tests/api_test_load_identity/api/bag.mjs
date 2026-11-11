/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_identity/api/bag.mjs
 *	@Date: 2026-11-11T13:00:00-08:00 (1794430800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:00:00-08:00 (1794430800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for what a file starts while it loads: a module allowed the vault, which hands out closures
 * and runs what it is handed.
 * @module api_test_load_identity.bag
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * A closure that reads the vault.
 * @returns {Function} The closure.
 */
export const make = () => () => self.vault.get();

/**
 * An object holding such a closure.
 * @returns {{run: Function}} The object.
 */
export const box = () => ({ run: () => self.vault.get() });

/**
 * Run what it is handed.
 * @param {Function} fn - The function.
 * @returns {*} What it returned.
 */
export const call = (fn) => fn();
