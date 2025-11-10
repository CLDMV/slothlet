/**
 * @fileoverview Function name preference test for XMLParser.
 * Tests Rule 9 - Function Name Preference Over Sanitization.
 * File: xml-parser.mjs, Function: XMLParser (preserves XML capitalization)
 */

/**
 * Simple XML parser utility.
 * @param {string} xmlString - XML string to parse
 * @returns {Object} Parsed XML representation
 * @example
 * api.util.XMLParser('<root><item>test</item></root>'); // → parsed object
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
