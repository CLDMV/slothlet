/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/proxies/api-root-member-listing-asyncroot-eager.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:53-08:00 (1795869173)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module's listings and reads of the api root follow the rules its listings and reads of any other node
 * follow: the `asyncroot` root in eager mode, both runtimes and attributions, and the permission system off and disabled.
 *
 * @description
 * The cases and assertions live in `tests/vitests/setup/api-root-member-listing.mjs`.
 * @module tests/vitests/suites/proxies/api-root-member-listing-asyncroot-eager
 */

import { describeApiRootMemberListing } from "../../setup/api-root-member-listing.mjs";

describeApiRootMemberListing({ roots: ["asyncroot"], modes: ["eager"] });
