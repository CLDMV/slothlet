/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions/callers/class-service.mjs
 *	@Date: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-10 00:00:00 -07:00 (1752130800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

// A module (apiPath `callers.classService`) whose exported function returns a CLASS INSTANCE.
// The instance's methods call into the api via `self.*`. Because slothlet wraps returned class
// instances to preserve context, those method calls must be permission-checked as the module that
// created the instance (`callers.classService`) — exactly like the plain function below. Used to
// verify class-instance methods are neither exempt from nor spuriously denied by the permission
// layer (#183 review, Gap 1).
class Service {
	async readViaMethod() {
		return self.db.read.query("SELECT 1");
	}
}

export function makeService() {
	return new Service();
}

// Plain-function control: same `self.db.read.query` call, same creating module — used to assert the
// class-instance method resolves to the identical caller identity as an ordinary module function.
export function readViaFunction() {
	return self.db.read.query("SELECT 1");
}
