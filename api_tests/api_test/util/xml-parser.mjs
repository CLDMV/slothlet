/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/util/xml-parser.mjs
 *	@Date: 2025-11-10T09:52:57-08:00 (1762797177)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-12 21:33:05 -07:00 (1773376385)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Function name preference test for XMLParser — verifies uppercase prefix retention.
 * @module api_test.util.xmlParser
 * @memberof module:api_test
 */
export default function XMLParser(xmlString) {
	// Simple XML parsing for testing purposes
	const tagPattern = /<(\w+)>(.*?)<\/\1>/g;
	const result = {};
	let match;

	while ((match = tagPattern.exec(xmlString)) !== null) {
		const [, tagName, content] = match;
		result[tagName] = content;
	}

	return result;
}

