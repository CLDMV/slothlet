/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_permissions/callers/self-caller.mjs
 *	@Date: 2026-04-14T17:11:00-07:00 (1776211860)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:08-08:00 (1795868948)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";

export const callSelf = () => self.callers.selfCaller.identity();
export const identity = () => ({ ok: true, module: "self-caller" });
export const callOther = () => self.payments.charge.process(999);
