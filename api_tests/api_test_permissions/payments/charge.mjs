/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/payments/charge.mjs
 *	@Date: 2026-04-14 17:09:31 -07:00 (1776211771)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:12:28 -07:00 (1776211948)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

export const process = (amount) => ({ ok: true, module: "payments.charge", amount });
export const refund = (id) => ({ ok: true, module: "payments.charge", refundId: id });
