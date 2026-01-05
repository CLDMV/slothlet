/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /test-tmp/test.mjs
 *	@Date: 2026-01-02 14:35:16 -08:00 (1767393316)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-02 15:02:42 -08:00 (1767394962)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
import slothlet from "../index.mjs";
import path from "node:path";

const apiPath = path.resolve("./test-tmp/api4");

console.log("=== PRIMARY LOAD - Complete API dump ===");
const primaryApi = await slothlet({ dir: apiPath, debug: false });
console.log(primaryApi);

console.log("\\n=== ADDAPI LOAD - Complete API dump ===");
const baseApi = await slothlet({ dir: "./api_tests/api_test_collections", debug: false });
await baseApi.addApi("config", apiPath);
console.log(baseApi);
