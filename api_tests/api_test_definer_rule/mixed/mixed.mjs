/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_definer_rule/mixed/mixed.mjs
 *	@Date: 2026-11-08T19:11:03-08:00 (1794193863)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T22:58:01-08:00 (1794207481)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for the definer rule (#726): leaves of one file with different rights, and code outside every
 * export. Rules allow `mixed.trusted` to read the vault; nothing allows `mixed` or `mixed.plain` to. `trustedHands` returns
 * the helper, whose definer is still the file's module `mixed`, not the leaf that returned it.
 * @module api_test_definer_rule.mixed
 */
import { self } from "@cldmv/slothlet/runtime";

const helper = () => self.vault.get("helper");
export const trusted = () => () => self.vault.get("trusted");
export const plain = () => () => self.vault.get("plain");
export const viaHelper = () => helper;
export const trustedHands = () => helper;
