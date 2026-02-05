/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/util/xml-parser.mjs
 *	@Date: 2025-11-10T09:52:57-08:00 (1762797177)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:40:10 -08:00 (1770266410)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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







