/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /docs/generated/helpers.cjs
 *	@Date: 2025-09-09 13:22:38 -07:00 (1757449358)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-11 19:53:47 -07:00 (1773284027)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

// CommonJS so jsdoc2md can require() it

// Helper functions for template

const docletData = new Map();
const anchorMap = new Map();
let availableTypedefs = [];
// When true, typedef definitions were already inlined inside the main module block.
let slothletTypedefsInlined = false;

const helper = {
	// Equality comparison helper
	eq: (a, b) => a === b,
	and: (a, b) => a && b,
	or: (a, b) => a || b,
	not: (a) => !a,
	gt: (a, b) => a > b,

	// Utility functions
	concat: (...args) => {
		const arr = Array.from(args);
		arr.pop(); // remove Handlebars options hash
		return arr.join("");
	},

	// Check if doclets contain a root module
	hasRootModule(doclets) {
		return doclets.some(
			(doc) => doc.kind === "module" && doc.longname && doc.longname.startsWith("module:") && !doc.longname.includes(".") // Root module shouldn't have dots
		);
	},

	// Add dot prefix to name for TOC
	nameWithDot: (name) => "." + name,

	// Helper to check if a doclet should be included based on access level
	shouldInclude(doclet) {
		// Check if function/doclet is private
		const isPrivate = doclet.access === "private" || (doclet.tags && doclet.tags.some((tag) => tag.title === "private"));

		// Check if function/doclet is package-level
		const isPackage = doclet.access === "package" || (doclet.tags && doclet.tags.some((tag) => tag.title === "package"));

		// @internal items are always excluded from public docs (no flag can surface them)
		// Note: jsdoc-parse strips doclet.tags but preserves doclet.customTags
		const isInternal =
			(doclet.customTags && doclet.customTags.some((t) => t.tag === "internal")) ||
			(doclet.tags && doclet.tags.some((tag) => tag.title === "internal"));
		if (isInternal) return false;

		const hasPrivateFlag = process.argv.includes("--private");
		const hasPackageFlag = process.argv.includes("--package");

		// Private items: only show with --private flag
		if (isPrivate) {
			return hasPrivateFlag;
		}

		// Package items: show with --private or --package flag
		if (isPackage) {
			return hasPrivateFlag || hasPackageFlag;
		}

		// Public items: ALWAYS show
		return true;
	},

	// Clean display name for titles (remove module: prefix and escape underscores)
	displayName(name) {
		if (typeof name !== "string") return "";
		// Convert module:@cldmv/slothlet/api_tests/api_test_mixed to @cldmv/slothlet/api\_tests/api\_test\_mixed
		return name
			.replace(/^module:/, "")
			.replace(/\\/g, "\\\\")
			.replace(/_/g, "\\_");
	},

	// String startsWith helper
	startsWith(str, prefix) {
		if (typeof str !== "string" || typeof prefix !== "string") return false;
		return str.startsWith(prefix);
	},

	// Check if module has namespaces
	hasNamespaces(moduleDoc, options) {
		const allDocs = options.data.root;
		if (!moduleDoc || !Array.isArray(allDocs)) return false;
		return allDocs.some((doc) => doc.kind === "namespace" && format.normalizeMemberof(doc.memberof) === moduleDoc.longname);
	},

	// Escape HTML entities
	escapeHtml(str) {
		if (typeof str !== "string") return "";
		return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
	},

	// Get length of array/object
	length(obj) {
		if (!obj) return 0;
		if (Array.isArray(obj)) return obj.length;
		if (typeof obj === "object") return Object.keys(obj).length;
		return 0;
	},

	// Debug helper to check function matching
	debugFunction(doc, namespaceLongname) {
		return this.belongsToNamespace(format.normalizeMemberof(doc.memberof), namespaceLongname);
	},

	// Debug helper
	debug(_) {
		return "";
	}
};

const gets = {
	docletValue(obj, key) {
		if (!obj || !key) return undefined;
		// console.log("obj", obj);
		// obj = obj.map((doclet) => functions.processDoclet(doclet, null));
		obj = functions.processDoclet(obj, null);
		const doclet = docletData.get(obj.normalizedId);
		// console.log("doclet", doclet);
		// console.log("obj", obj);
		// process.exit(0);
		return doclet ? doclet[key] : obj ? obj[key] : undefined;
	},
	// Get original module title (from @module tag, not affected by @name)
	originalModuleTitle() {
		// For modules, prefer alias (which should contain the original path)
		// over name (which might be shortened by @name tag)
		if (this.kind === "module") {
			if (this.alias && this.alias !== this.name) {
				return this.alias.replace(/\\/g, "\\\\").replace(/_/g, "\\_");
			}
			// Fallback to longname if no alias
			const originalPath = this.longname.replace(/^module:/, "");
			return originalPath.replace(/\\/g, "\\\\").replace(/_/g, "\\_");
		}
		return this.name || "";
	},

	// Check if a module has a callable function (same longname)
	moduleFunction(doclets, moduleLongname) {
		if (!Array.isArray(doclets) || !moduleLongname) return null;
		return doclets.find((doc) => doc.kind === "function" && doc.longname === moduleLongname && helper.shouldInclude(doc));
	},

	/**
	 * Get the depth of a module based on '/' separators in the module name
	 * @param {string} moduleName - Module name like "@cldmv/slothlet/runtime"
	 * @returns {number} Depth level (0 for root, 1 for first level, etc.)
	 */
	moduleDepth(moduleName) {
		if (!moduleName || typeof moduleName !== "string") return 0;
		const cleanName = moduleName.replace(/^module:/, "");
		const parts = cleanName.split("/");
		return parts.length - 1; // Root has 0 depth, "/runtime" has depth 1
	},

	/**
	 * Order modules hierarchically with smart parent-child relationships
	 * Parents appear first, then their children in alphabetical order within each level
	 * @param {Array} doclets - Array of all doclets
	 * @returns {Array} Ordered array of module doclets
	 */
	orderModulesHierarchically(doclets) {
		if (!Array.isArray(doclets)) return [];

		// Filter for modules only (exclude @internal modules from public docs)
		const modules = doclets.filter(
			(doclet) => doclet.kind === "module" && doclet.longname && doclet.longname.startsWith("module:") && helper.shouldInclude(doclet)
		);

		// Sort by depth first, then alphabetically
		return modules.sort((a, b) => {
			const depthA = gets.moduleDepth(a.longname);
			const depthB = gets.moduleDepth(b.longname);

			// Primary sort: by depth (parents first)
			if (depthA !== depthB) {
				return depthA - depthB;
			}

			// Secondary sort: alphabetically within same depth
			return a.longname.localeCompare(b.longname);
		});
	},

	/**
	 * Check if a child module should share typedefs with its parent
	 * @param {string} childModule - Child module name
	 * @param {string} parentModule - Parent module name
	 * @returns {boolean} Whether typedefs should be shared
	 */
	shouldShareTypedefs(childModule, parentModule) {
		if (!childModule || !parentModule) return false;
		const cleanChild = childModule.replace(/^module:/, "");
		const cleanParent = parentModule.replace(/^module:/, "");
		return cleanChild.startsWith(cleanParent + "/");
	},

	/**
	 * Get the primary module for typedef definitions (first parent in hierarchy)
	 * @param {string} moduleName - Module name to find primary for
	 * @param {Array} allModules - All available modules
	 * @returns {string} Primary module name for typedef definitions
	 */
	getPrimaryModuleForTypedefs(moduleName, allModules) {
		if (!moduleName || !Array.isArray(allModules)) return moduleName;

		const cleanName = moduleName.replace(/^module:/, "");
		const parts = cleanName.split("/");

		// Find the root module (first part)
		for (let i = 0; i < parts.length; i++) {
			const candidateName = parts.slice(0, i + 1).join("/");
			const moduleExists = allModules.some((mod) => mod.longname === `module:${candidateName}`);
			if (moduleExists) {
				return `module:${candidateName}`;
			}
		}

		return moduleName; // Fallback to original if no parent found
	},

	/**
	 * Determine if this module should show typedef definitions
	 * Only the primary (root) module in a hierarchy should show typedefs
	 * @param {string} moduleName - Current module name
	 * @param {Array} allModules - All available modules
	 * @returns {boolean} Whether this module should show typedefs
	 */
	shouldShowTypedefs(moduleName, allModules) {
		if (!moduleName || !Array.isArray(allModules)) return true;

		const primaryModule = gets.getPrimaryModuleForTypedefs(moduleName, allModules);
		return primaryModule === moduleName; // Only show typedefs if this is the primary module
	},

	/**
	 * Builds a simpleName for a doclet by traversing the memberOf chain up to parents.
	 * Stops early if any parent in the chain has a customTags.simpleName property.
	 * @param {object} doclet - The doclet to build a simpleName for
	 * @returns {string} The constructed simpleName based on the parent chain
	 */
	simpleNameFromChain(doclet, short = false) {
		if (!doclet || !doclet.normalizedMemberof) {
			return doclet?.name || doclet?.simpleName || "";
		}

		const nameParts = [];
		let currentDoclet = doclet;
		let hasParent = false;
		let foundSimpleName = false;
		let visited = new Set(); // Prevent infinite loops

		// Start with the current doclet's name
		if (currentDoclet.name) {
			nameParts.unshift(currentDoclet.name);
		}
		if (currentDoclet.normalizedMemberof) {
			hasParent = true;
		}

		// Traverse up the memberof chain using existing getParentDoclet method
		while (currentDoclet.normalizedMemberof && !visited.has(currentDoclet.id || currentDoclet.longname)) {
			// Mark current as visited to prevent cycles
			visited.add(currentDoclet.id || currentDoclet.longname);

			// Use the existing getParentDoclet method
			const parentDoclet = functions.getParentDoclet(currentDoclet.normalizedMemberof);

			if (!parentDoclet) {
				// No parent found, stop traversal
				break;
			}

			// Check if parent has customTags with simpleName tag - if so, break out early
			if (parentDoclet.customTags && Array.isArray(parentDoclet.customTags)) {
				const hasSimpleNameTag = parentDoclet.customTags.some((tag) => tag.tag && tag.tag.toLowerCase() === "simplename");
				if (hasSimpleNameTag) {
					foundSimpleName = true;
					break;
				}
			}

			// Add parent name to the chain (at the beginning)
			if (parentDoclet.name) {
				nameParts.unshift(parentDoclet.name);
			}

			// Move up to the next parent
			currentDoclet = parentDoclet;
		}

		let periodPrefix = "";
		if (doclet.level > 0) {
			if (doclet.level > 1 || doclet.kind !== "constant") {
				periodPrefix = ".";
			}
		}

		if (short) {
			if (hasParent) {
				return periodPrefix + nameParts[nameParts.length - 1] || "";
			}
			return nameParts[nameParts.length - 1] || "";
		}
		// If we have a parent and found a simpleName tag, prefix with period
		if (hasParent && foundSimpleName) {
			nameParts[0] = periodPrefix + nameParts[0];
		}
		// Join the parts with dots to create the simpleName
		return nameParts.join(".");
	}
};

const format = {
	// Format parameters for function signature
	params(params) {
		if (!Array.isArray(params) || params.length === 0) return "()";
		const paramNames = params.map((p) => p.name || "param");
		return "(" + paramNames.join(", ") + ")";
	},

	// Format return description
	returnsDesc(returns) {
		if (!Array.isArray(returns) || returns.length === 0) return "";
		const returnInfo = returns[0];
		let desc = returnInfo.description || "";
		// Strip HTML tags like <p> and </p>
		desc = desc.replace(/<\/?p>/g, "").trim();
		return desc;
	},

	// Get preferred function name based on tilde pattern (autoIp~autoIP -> autoIP)
	preferredFunctionName(item) {
		// doclet.normalizedId
		if (!item || !item.doclet) return item?.name || "";

		const doclet = item.doclet;
		// const longname = doclet.longname || "";

		// // Check for tilde pattern: moduleName~functionName
		// if (longname.includes("~")) {
		// 	const parts = longname.split("~");
		// 	if (parts.length >= 2) {
		// 		const firstPart = parts[parts.length - 2].split(".").pop() || ""; // Get last segment before ~
		// 		const secondPart = parts[parts.length - 1]; // Get part after ~

		// 		// If they match when lowercased, use the second part (function name)
		// 		if (firstPart.toLowerCase() === secondPart.toLowerCase()) {
		// 			return secondPart;
		// 		}
		// 	}
		// }

		// Default to the doclet's name or item name
		return doclet.simpleName || item.simpleName || doclet.name || item.name || "";
	},

	// Format type for table - with HTML entities
	typeForTable(type) {
		if (!type || !type.names || !Array.isArray(type.names)) return "";
		let typeStr = type.names.join(" | ");
		// Convert < and > to HTML entities like the original
		typeStr = helper.escapeHtml(typeStr);
		return typeStr;
	},

	// Format parameters for TOC - like "(a, b)" not "((a, b))"
	// Only show top-level parameters, not nested ones like "options.property"
	paramsForTOC(params) {
		if (!Array.isArray(params) || !params.length) return "";
		return params
			.filter((p) => p.name && !p.name.includes("."))
			.map((p) => p.name || "param")
			.join(", ");
	},

	// Format returns for TOC - like "Promise.<number>" with HTML entities
	returnsForTOC(returns) {
		if (!Array.isArray(returns) || !returns.length) return "";
		const returnInfo = returns[0];
		if (!returnInfo || !returnInfo.type || !returnInfo.type.names) return "";

		const types = returnInfo.type.names;
		if (!Array.isArray(types) || !types.length) return "";

		let typeStr = types.join(" | ");
		// Convert < and > to HTML entities like the original
		typeStr = helper.escapeHtml(typeStr);
		return "<code>" + typeStr + "</code>";
	},

	// Format type for table with typedef linking
	typeForTableWithLinks(type) {
		if (!type || !type.names || !Array.isArray(type.names)) return "";

		let typeNames = type.names.map((typeName) => {
			// Clean the type name (remove array brackets, etc.)
			const cleanTypeName = typeName.replace(/\[\]$/, "");
			const isArray = typeName.endsWith("[]");

			// Check if this type is a known typedef in the global availableTypedefs array
			if (availableTypedefs && Array.isArray(availableTypedefs)) {
				const typedef = availableTypedefs.find((td) => td.name === cleanTypeName || td.simpleName === cleanTypeName);
				if (typedef) {
					// Use the pre-computed anchor from the typedef object
					const anchor = typedef.anchor;
					const linkedType = `[${cleanTypeName}](#${anchor})`;
					return isArray ? `${linkedType}[]` : linkedType;
				}
			}

			return typeName;
		});

		let typeStr = typeNames.join(" | ");
		typeStr = helper.escapeHtml(typeStr);
		return typeStr;
	},

	// Normalize memberof strings that have -- patterns where -- is equivalent to module:
	// Example: "module:@cldmv/slothlet--slothlet" becomes "module:@cldmv/slothlet"
	// Example: "module:@cldmv/slothlet--slothlet/runtime" becomes "module:@cldmv/slothlet/runtime"
	normalizeMemberof(memberof, doclet = null, allowDoubleDash = false) {
		if (typeof memberof !== "string") return memberof;

		let result = memberof;

		// Handle module: pattern which is equivalent to --
		// "api_test.util.module:util" should become "module:api_test.util"
		// "api_test.util.module:util~secondFunc" should become "module:api_test.util.secondFunc"
		if (memberof.includes(".module:")) {
			const moduleIndex = memberof.indexOf(".module:");
			const beforeModule = memberof.substring(0, moduleIndex); // "api_test.util"
			const afterModule = memberof.substring(moduleIndex + 8); // "util" or "util~secondFunc"

			// Extract the expected module name (last part of beforeModule)
			const expectedModuleName = beforeModule.split(".").pop(); // "util"

			// Check if afterModule starts with the expected module name
			if (afterModule.startsWith(expectedModuleName)) {
				const remainder = afterModule.substring(expectedModuleName.length); // "" or "~secondFunc"

				if (remainder.startsWith("~")) {
					// Handle function case: "util~secondFunc" -> ".secondFunc"
					result = `module:${beforeModule}${remainder.replace("~", ".")}`;
				} else {
					// Handle plain module case: "util" -> ""
					result = `module:${beforeModule}`;
				}
			} else {
				// Fallback: preserve original structure but convert tildes to dots
				const afterModuleNormalized = afterModule.replace("~", ".");
				result = `module:${beforeModule}.${afterModuleNormalized}`;
			}
		}
		// Handle -- pattern where -- is equivalent to module:
		// "module:@cldmv/slothlet--slothlet" means "module:module:@cldmv/slothlet"
		// "module:@cldmv/slothlet--slothlet/runtime" means "module:module:@cldmv/slothlet/runtime"
		// "api_test--math" should preserve the namespace: "module:api_test.math"
		else if (memberof.includes("--") && !allowDoubleDash) {
			// Find the -- pattern and split around it
			const dashIndex = memberof.indexOf("--");
			const beforeDash = memberof.substring(0, dashIndex); // "module:@cldmv/slothlet" or "api_test"
			const afterDash = memberof.substring(dashIndex + 2); // "slothlet" or "slothlet/runtime" or "math"

			// If beforeDash doesn't start with module:, add it
			const modulePrefix = beforeDash.startsWith("module:") ? beforeDash : `module:${beforeDash}`;

			// The part after -- should start with the module name (like "slothlet")
			// We want to remove that redundant part and keep any suffix
			const moduleBaseName = modulePrefix.substring(modulePrefix.lastIndexOf("/") + 1).replace("module:", ""); // "slothlet" or "api_test"

			// Strip jsdoc's "exports." prefix which is added for ESM `export const` declarations
			// e.g. "exports.slothlet/runtime" → "slothlet/runtime"
			const afterDashClean = afterDash.startsWith("exports.") ? afterDash.substring("exports.".length) : afterDash;

			if (afterDashClean.startsWith(moduleBaseName)) {
				const suffix = afterDashClean.substring(moduleBaseName.length); // "" or "/runtime"
				result = modulePrefix + suffix;
			} else {
				// For cases like "api_test--math", preserve the namespace: "module:api_test.math"
				result = modulePrefix + "." + afterDashClean;
			}
		} else {
			result = memberof;
		}

		// Auto-detect whether to remove "module:" prefix based on doclet
		// Remove "module:" prefix for ID and longname ONLY if the original doclet is not of kind "module"
		if (doclet && doclet.kind !== "module" && result.startsWith("module:")) {
			result = result.substring(7); // Remove "module:" prefix
		}

		// Check for duplicate segments at the end (e.g., "api_test.exportDefault.exportDefault" -> "api_test.exportDefault")
		const parts = result.split(".");
		if (parts.length >= 2 && parts[parts.length - 1].toLowerCase() === parts[parts.length - 2].toLowerCase()) {
			parts.splice(-2, 1); // Remove the second-to-last duplicate segment
			result = parts.join(".");
		}

		return result;
	},

	// Convert ID to anchor name (encode only truly problematic characters)
	generateAnchor(id) {
		if (!id) return "";

		id = id
			.replace(/:/g, "_") // colons to underscores
			.replace(/@/g, "_at_") // @ to _at_ (preserves meaning)
			.replace(/--/g, "_ddash_") // -- to _dash_ (preserves meaning)
			.replace(/\//g, "_slash_") // / to _slash_ (preserves meaning)
			.replace(/\./g, "_dot_") // . to _dot_ (periods might cause ESLint issues)
			.replace(/#/g, "_hash_") // # to _hash_ (# is invalid in anchor IDs)
			.replace(/\s+/g, "_") // spaces to underscores
			.replace(/[<>'"&]/g, "") // Remove only truly problematic HTML characters
			.replace(/_+/g, "_"); // remove duplicate underscores

		// First ltrim "module_" from the beginning
		if (id.startsWith("module_")) {
			id = id.substring(7); // Remove "module_" (7 characters)
		}

		// Then ltrim any non-alphabetic characters from the beginning
		id = id.replace(/^[^a-zA-Z]+/, "");

		// if (id.startsWith("at_")) {
		// 	id = id.substring(3); // Remove "at_" (3 characters)
		// }

		// Only encode characters that are actually problematic for markdown/HTML anchors
		return id;
	},

	// Get kind in context - follows dmd standard pattern from helpers.js
	getKindInThisContext(doclet) {
		if (!doclet) return "unknown";

		if (doclet.kind === "function" && doclet.memberof) {
			return "method";
		} else if (doclet.kind === "member" && !doclet.isEnum && doclet.memberof) {
			return "property";
		} else if (doclet.kind === "member" && doclet.isEnum && doclet.memberof) {
			return "enum property";
		} else if (doclet.kind === "member" && doclet.isEnum && !doclet.memberof) {
			return "enum";
		} else if (doclet.kind === "member" && doclet.scope === "global") {
			return "variable";
		} else {
			return doclet.kind;
		}
	},

	escapeForTable(description) {
		description = description
			// Remove paragraph tags
			.replace(/<\/?p>/g, "")
			// Convert lists to simple text with bullets
			// .replace(/<ul>/g, "")
			// .replace(/<\/ul>/g, "")
			// .replace(/<li>/g, "• ")
			// .replace(/<\/li>/g, " ")
			// Convert code tags to backticks
			.replace(/<code>/g, "`")
			.replace(/<\/code>/g, "`")
			// Convert strong tags
			.replace(/<strong>/g, "**")
			.replace(/<\/strong>/g, "**")
			// Remove any remaining HTML tags
			// .replace(/<[^>]*>/g, "")
			// Decode HTML entities
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&amp;/g, "&") // Keep this last to avoid double-decoding
			// Clean up extra whitespace and newlines
			.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (match, content) => {
				const cleanContent = content.replace(/\n/g, "<br>");
				return `<blockquote>${cleanContent}</blockquote>`;
			})
			.replace(/\s+/g, " ")
			.replace(/<blockquote><br>/g, "<blockquote>")
			.trim()
			// Escape backslash characters to avoid Markdown escape issues in tables
			.replace(/\\/g, "\\\\")
			// Escape pipe characters that would break the table
			.replace(/\|/g, "\\|");
		return description;
	}
};

const functions = {
	/**
	 * Central doclet processing function that organizes all doclets for consistent use
	 * across TOC and content generation functions
	 * @param {Array} doclets - All JSDoc doclets
	 * @param {string} baseModuleLongname - The base module name
	 * @returns {Object} Processed data structure with items in JSDoc order
	 */
	// Helper function to determine preferred name based on function name preference logic
	getPreferredName(doclet) {
		// Debug first few calls to see if function is being called at all
		if (!this._debugCount) this._debugCount = 0;
		// if (this._debugCount < 3) {
		// 	console.log(`[DEBUG ${this._debugCount}] getPreferredName called with: ${doclet.longname} (name: ${doclet.name})`);
		// 	this._debugCount++;
		// }

		// Debug all calls with autoI
		// if (doclet.longname && doclet.longname.includes("autoI")) {
		// 	console.log(`[DEBUG] getPreferredName called with: ${doclet.longname} (name: ${doclet.name})`);
		// }

		// Check for pattern like "autoIp~autoIP" in longname
		if (doclet.longname && doclet.longname.includes("~")) {
			const parts = doclet.longname.split("~");
			if (parts.length === 2) {
				// Extract the part after the last : or . before ~
				const beforeTilde = parts[0];
				const afterTilde = parts[1];

				// Get the name part from before ~ (after last : or .)
				const firstNameMatch = beforeTilde.match(/[:.:]([^:.]+)$/);
				const firstName = firstNameMatch ? firstNameMatch[1] : beforeTilde.split(/[:.]/).pop();
				const secondName = afterTilde;

				// Debug logging
				// if (doclet.longname && doclet.longname.includes("autoI")) {
				// 	console.log(`[DEBUG] Processing ${doclet.longname}`);
				// 	console.log(`  doclet.name: ${doclet.name}`);
				// 	console.log(`  beforeTilde: ${beforeTilde}`);
				// 	console.log(`  afterTilde: ${afterTilde}`);
				// 	console.log(`  firstNameMatch: ${JSON.stringify(firstNameMatch)}`);
				// 	console.log(`  firstName: ${firstName}`);
				// 	console.log(`  secondName: ${secondName}`);
				// 	console.log(`  firstName.toLowerCase(): ${firstName?.toLowerCase()}`);
				// 	console.log(`  secondName.toLowerCase(): ${secondName?.toLowerCase()}`);
				// 	console.log(`  match: ${firstName && firstName.toLowerCase() === secondName.toLowerCase()}`);
				// }

				// If both names match when lowercased, use the second (actual function) name
				if (firstName && firstName.toLowerCase() === secondName.toLowerCase()) {
					return secondName;
				}
			}
		}

		// Default to the doclet's name
		return doclet.name;
	},

	processDoclet(doclet) {
		if (!doclet || typeof doclet !== "object") return doclet;
		doclet = functions.applyNormalize(doclet);
		doclet = functions.applyAnchor(doclet);
		doclet = functions.applySimpleName(doclet);
		return doclet;
	},

	applyNormalize(doclet) {
		if (doclet.kind === "typedef") {
			// Handle typedef-specific normalization here
			doclet.longname = "typedef:" + doclet.longname.replace(/^typedef:/, "");
		}
		let normalizedMemberof = doclet.memberof ? format.normalizeMemberof(doclet.memberof) : "";
		const normalizedLongname = format.normalizeMemberof(doclet.longname || "", doclet);
		const normalizedId = format.normalizeMemberof(doclet.id || "", doclet);
		const normalizedRealId = format.normalizeMemberof(doclet.id || "", doclet, true);

		if (normalizedMemberof.toLowerCase() === "module:" + normalizedId.toLowerCase()) {
			normalizedMemberof = "module:" + normalizedId;
		}

		// const lNamePrefix = doclet.kind !== "typedef" ? "module:" : "";
		// const lName = doclet.longname ? lNamePrefix + doclet.longname.split(".").shift() : "";
		return {
			...doclet,
			normalizedMemberof,
			normalizedLongname,
			normalizedId,
			normalizedRealId
		};
	},

	applySimpleName(doclet) {
		const lNamePrefix = doclet.kind !== "typedef" ? "module:" : "";
		const lName = doclet.longname ? lNamePrefix + doclet.longname.split(".").shift() : "";
		return {
			...doclet,
			// Add simple name extraction for display purposes
			simpleName: gets.simpleNameFromChain(doclet) || doclet.name || lName,
			simpleNameShort: gets.simpleNameFromChain(doclet, true) || doclet.name || lName
		};
	},

	applyAnchor(doclet) {
		// normalizedIdBackup
		const anchorKey1 = doclet.normalizedLongname || doclet.normalizedId;
		const anchorKey2 = doclet.normalizedRealId || anchorKey1;

		let anchor1 = format.generateAnchor(anchorKey1);
		let anchor2 = format.generateAnchor(anchorKey2);
		// anchor = anchor.replace(/_+/, "_");
		anchorMap.set(doclet.normalizedLongname || doclet.normalizedId, anchor1);
		if (doclet.normalizedLongnameBackup) {
			anchorMap.set(doclet.normalizedRealId, anchor2);
		}
		return {
			...doclet,
			anchor: anchor1,
			anchorSmart: anchor2
		};
	},

	processDoclets(doclets, baseModuleLongname) {
		if (!Array.isArray(doclets))
			return {
				items: {},
				constants: [],
				typedefs: [],
				globalTypedefs: [],
				anchors: new Map(),
				baseModule: null,
				baseModuleLongname: "",
				baseModuleName: ""
			};
		if (!baseModuleLongname || typeof baseModuleLongname !== "string")
			return {
				items: {},
				constants: [],
				typedefs: [],
				globalTypedefs: [],
				anchors: new Map(),
				baseModule: null,
				baseModuleLongname: "",
				baseModuleName: ""
			};

		const baseModuleName = baseModuleLongname.replace(/^module:/, "");

		let normalizedDoclets = doclets.map((doclet) => functions.applyNormalize(doclet));

		// Filter to only include doclets that belong to this module
		normalizedDoclets = normalizedDoclets.filter((doclet) => {
			if (!helper.shouldInclude(doclet)) return;
			const normalizedMemberof = doclet.normalizedMemberof || "";
			return normalizedMemberof === baseModuleLongname || normalizedMemberof.startsWith(baseModuleLongname + ".");
		});

		normalizedDoclets = normalizedDoclets.map((doclet) => functions.applyAnchor(doclet));

		// STEP 1: Sort ALL doclets by their order property to maintain JSDoc sequence
		const sortedDoclets = [...normalizedDoclets].sort((a, b) => (a.order || 0) - (b.order || 0));

		// STEP 1b: Collision resolution — mimic slothlet's default merge behaviour.
		// When a root-level file (e.g. math.mjs) and a same-named folder module
		// (e.g. math/math.mjs) both declare the same export name, slothlet merges
		// them and the root-level file wins for any overlapping keys.
		// Detect duplicates by (name + normalizedMemberof), then keep the doclet
		// whose source file sits closest to the API root (fewest path components).
		(function deduplicateCollisions() {
			// Build a collision map: key → [docletIndex, ...]
			const seen = new Map();
			sortedDoclets.forEach((doclet, idx) => {
				if (!doclet.name || !doclet.normalizedMemberof) return;
				// Only deduplicate callable / value doclets; keep namespace/module bridges
				if (doclet.kind === "module" || doclet.kind === "namespace" || doclet.kind === "typedef") return;
				const key = `${doclet.normalizedMemberof}::${doclet.name}`;
				if (!seen.has(key)) {
					seen.set(key, [idx]);
				} else {
					seen.get(key).push(idx);
				}
			});

			// For each collision group, identify the root-file winner (shallowest meta.path)
			// and mark all others as superseded so they are excluded from further processing.
			// - loserNames: Set of function names superseded by the root file
			// - loserPaths: Set of meta.path values for the losing files
			const loserNames = new Set();
			const loserPaths = new Set();

			seen.forEach((indices) => {
				if (indices.length < 2) return;
				// Sort by path depth ascending (fewer separators = closer to API root = wins)
				indices.sort((a, b) => {
					const pathA = sortedDoclets[a].meta?.path || "";
					const pathB = sortedDoclets[b].meta?.path || "";
					const depthA = (pathA.match(/[\\/]/g) || []).length;
					const depthB = (pathB.match(/[\\/]/g) || []).length;
					return depthA - depthB;
				});
				// Mark losers as superseded (keep index 0 = shallowest = winner)
				for (let i = 1; i < indices.length; i++) {
					sortedDoclets[indices[i]].__slothletCollisionLoser = true;
					loserNames.add(sortedDoclets[indices[i]].name);
					const loserPath = sortedDoclets[indices[i]].meta?.path;
					if (loserPath) loserPaths.add(loserPath);
				}
			});

			// Remove losers in-place
			for (let i = sortedDoclets.length - 1; i >= 0; i--) {
				if (sortedDoclets[i].__slothletCollisionLoser) sortedDoclets.splice(i, 1);
			}

			// Second pass: strip examples referencing collision-loser names from any module-level
			// overview doclets (e.g. @alias constants) that came from a losing file. This prevents
			// the overview section from showing stale values for superseded functions.
			if (loserNames.size > 0 && loserPaths.size > 0) {
				// Build a regex that matches any example line containing a loser function call
				const loserPattern = new RegExp(`\\.(?:${[...loserNames].join("|")})\\s*\\(`, "g");
				sortedDoclets.forEach((doclet) => {
					if (!doclet.examples || !Array.isArray(doclet.examples)) return;
					const docPath = doclet.meta?.path || "";
					if (!loserPaths.has(docPath)) return;
					// Filter out individual code lines inside examples that reference loser names.
					// Each example is a string (a code block); we strip lines that call loser funcs.
					doclet.examples = doclet.examples
						.map((example) => {
							const lines = example.split("\n");
							const filtered = lines.filter((line) => !loserPattern.test(line));
							// Reset lastIndex since we used the global flag
							loserPattern.lastIndex = 0;
							return filtered
								.join("\n")
								.replace(/\n{3,}/g, "\n\n")
								.trim();
						})
						.filter(Boolean);
				});
			}
		})();

		// console.log(sortedDoclets);
		// console.dir(sortedDoclets, { depth: 1 });
		// console.log(baseModuleLongname);

		// Assuming you already have these:
		// const hierarchy = buildHierarchy(sortedDoclets, baseModuleLongname);

		// Example: pretty print top level
		// console.dir(hierarchy, { depth: 3 });

		// process.exit(0);

		// Find top level doclets and extract constants
		const topLevelDoclets = [];
		const exportedConstants = [];
		// const allRelevantDoclets = [...sortedDoclets]; // Keep all doclets for further processing

		sortedDoclets.forEach((doclet) => {
			// Check if this is a top level doclet (belongs directly to the base module)
			if (doclet.normalizedMemberof === baseModuleLongname) {
				// Check if this doclet has an alias that should replace a previous record
				if (doclet.alias) {
					// Check if this doclet's alias matches an existing record's normalizedId or normalizedLongname
					const existingIndex = topLevelDoclets.findIndex(
						(existing) =>
							existing.normalizedId === doclet.alias || existing.normalizedLongname === doclet.alias || existing.alias === doclet.alias
					);

					if (existingIndex !== -1) {
						// Replace the existing record
						// console.log(`[REPLACE] Replacing ${topLevelDoclets[existingIndex].name} (${topLevelDoclets[existingIndex].kind}) with ${doclet.kind} ${doclet.name}`);
						// console.log(`[REPLACE] Match: existing.normalizedId="${topLevelDoclets[existingIndex].normalizedId}" vs doclet.alias="${doclet.alias}"`);
						const t = { ...topLevelDoclets[existingIndex] };
						delete t?.children; // Remove children to avoid nesting issues
						topLevelDoclets[existingIndex] = { ...t, ...doclet };
					} else {
						// Constants whose alias is a DIRECT child of the base module (no dots in the suffix)
						// are module bridge doclets (e.g., module:api_test.math) and must appear in the TOC.
						// Only nested constants (e.g., module:api_test.math.collisionVersion) go to exportedConstants.
						const aliasSuffix = doclet.alias ? doclet.alias.slice(baseModuleLongname.length + 1) : "";
						if (
							doclet.kind === "constant" &&
							doclet.isExported === true &&
							doclet.alias &&
							doclet.alias.startsWith(baseModuleLongname + ".") &&
							aliasSuffix.includes(".")
						) {
							// Nested constant — not a direct module entry
							exportedConstants.push(doclet);
						} else {
							// Add as top level (includes module bridge constants like math, tcp, rootstring)
							topLevelDoclets.push(doclet);
						}
					}
				} else {
					// Skip module container doclets that don't have aliases - they are just containers
					if (doclet.kind === "module") {
						// console.log(`[SKIP MODULE] Skipping module container: ${doclet.name} (kind: ${doclet.kind}, no alias)`);
					} else if (doclet.memberof && doclet.memberof !== baseModuleLongname) {
						// This doclet's raw memberof points to a sub-module (e.g., "api_test.module:math")
						// even though normalization collapsed it to the base module. Skip here —
						// it will be picked up as a child during processChildrenRecursive.
					} else {
						// Regular top level doclet (no alias) - only add non-module items
						topLevelDoclets.push(doclet);
					}
				}
			}
			// Also check for functions with aliases that point to the base module (like exportDefault function)
			else if (doclet.alias && doclet.alias.startsWith(baseModuleLongname + ".")) {
				const baseModuleWithoutPrefix = baseModuleLongname.replace(/^module:/, "");
				if (doclet.alias.startsWith("module:" + baseModuleWithoutPrefix + ".")) {
					// console.log(`[CROSS-MODULE ALIAS] Found ${doclet.name} with alias ${doclet.alias} pointing to base module`);
					topLevelDoclets.push(doclet);
				}
			}
			// Root callable: function with @alias pointing exactly at the base module itself
			// (e.g., greet @alias module:api_test makes the entire api callable as api_test(name))
			else if (doclet.alias === baseModuleLongname) {
				topLevelDoclets.push(doclet);
			}
			// Note: All other doclets (children of top level items) are preserved in allRelevantDoclets

			// Extract constants that have a valid alias format <module>.<const> (not module: prefix)
			if (
				doclet.kind === "constant" &&
				doclet.isExported === true &&
				doclet.alias &&
				// !doclet.alias.startsWith("module:") &&
				doclet.alias.startsWith(baseModuleLongname + ".")
			) {
				exportedConstants.push(doclet);
			}
		});

		// console.log(`[PROCESSING] Found ${topLevelDoclets.length} top level doclets and ${exportedConstants.length} exported constants`);
		// topLevelDoclets.forEach(doc => console.log(`[TOP LEVEL] ${doc.name} (${doc.kind}) - alias: ${doc.alias}`));
		// exportedConstants.forEach(doc => console.log(`[CONSTANT] ${doc.name} (${doc.kind}) - alias: ${doc.alias}`));

		// process.exit(0);
		// Process topLevelDoclets into nested object structure
		// Start with the base module as the root container
		// console.log(`[DEBUG] Looking for base module with longname: "${baseModuleLongname}"`);
		// Search in doclets to get the module doclet (before filtering)
		let baseModuleDoclet = doclets.find((d) => {
			if (d.kind === "module" && d.longname === baseModuleLongname) {
				// console.log(`[DEBUG] FOUND base module doclet: kind=${d.kind}, longname="${d.longname}"`);
				return true;
			}
			return false;
		});
		// console.log(baseModuleDoclet);
		// process.exit(0);
		baseModuleDoclet = functions.processDoclet(baseModuleDoclet);
		baseModuleDoclet.level = 0; // Root level
		// console.log(`[DEBUG] Found base module doclet:`, baseModuleDoclet ? "YES" : "NO");

		const nestedStructure = {
			[baseModuleName]: {
				type: "module",
				doclet: baseModuleDoclet,
				children: {}
			}
		};

		// console.log(topLevelDoclets);
		// process.exit(0);
		// console.log(`[DEBUG] baseModuleLongname: "${baseModuleLongname}", starting with base module container`);

		// Now process all top-level doclets as children of the base module
		topLevelDoclets.forEach((doclet) => {
			// Get the base module container
			const baseModuleContainer = nestedStructure[baseModuleName];

			// Items with aliases are direct items (like config, funcmod, math, etc.)
			if (doclet.alias) {
				// Remove module: prefix and base module prefix to get just the item name
				let aliasPath = doclet.alias.replace(/^module:/, "");
				const baseModuleWithoutPrefix = baseModuleLongname.replace(/^module:/, "");

				if (aliasPath.startsWith(baseModuleWithoutPrefix + ".")) {
					aliasPath = aliasPath.replace(baseModuleWithoutPrefix + ".", "");
				}

				// Check if this should be nested (contains dots) or direct (no dots)
				if (aliasPath.includes(".")) {
					// This is a nested item like "util.controller" -> should be "controller" under "util"
					const pathParts = aliasPath.split(".");
					// console.log(`[NESTED] ${doclet.name} (alias: ${doclet.alias}) -> path: ${pathParts.join(' -> ')}`);

					// Create nested structure under the base module
					let current = baseModuleContainer.children;
					for (let i = 0; i < pathParts.length; i++) {
						const part = pathParts[i];
						const isLast = i === pathParts.length - 1;

						if (!current[part]) {
							// Build namespace path for auto-generation
							const namespacePath = pathParts.slice(0, i + 1);
							const fullNamespacePath = `${baseModuleLongname.replace("module:", "")}.${namespacePath.join(".")}`;
							const baseModuleName = baseModuleLongname.replace("module:", "");

							current[part] = {
								type: isLast ? "item" : "namespace",
								doclet: isLast ? doclet : functions.missingNamespace(fullNamespacePath, baseModuleName),
								children: {}
							};
						} else if (isLast) {
							// Update existing namespace to be an item
							current[part].type = "item";
							current[part].doclet = doclet;
						}

						current = current[part].children;
					}
				} else {
					// This is a direct item like "config", "math", etc.
					// SPECIAL CASE: If this function's alias matches the base module,
					// it should replace the base module container itself
					if (doclet.alias === baseModuleLongname) {
						const t = { ...baseModuleContainer };
						// console.log(`[FUNCTION REPLACES MODULE] ${doclet.name} replaces base module`);
						const originalDescription = t.doclet.description || "";
						const newDescription = doclet.description || "";
						const originalSummary = t.doclet.summary || "";
						const newSummary = doclet.summary || "";
						t.type = "direct";
						// baseModuleContainer.type2 = "direct";
						baseModuleContainer.doclet = { ...t.doclet, ...doclet };
						// Use whichever description has the highest string count
						baseModuleContainer.doclet.normalizedIdBackup = doclet.normalizedId ? t.doclet.normalizedId : "";
						baseModuleContainer.doclet.normalizedLongnameBackup = doclet.normalizedLongname ? t.doclet.normalizedLongname : "";
						baseModuleContainer.doclet.examplesBackup = doclet.examples ? t.doclet.examples : [];
						baseModuleContainer.doclet.descriptionBackup = newDescription;
						baseModuleContainer.doclet.summaryBackup = newSummary;
						baseModuleContainer.doclet.description =
							newDescription.length > originalDescription.length ? newDescription : originalDescription;
						// Use whichever summary has the highest string count
						baseModuleContainer.doclet.summary = newSummary.length > originalSummary.length ? newSummary : originalSummary;
						// Preserve the module's anchor and display name so the root callable links to
						// the ## section anchor and shows the module name (e.g., "api_test(name)")
						// rather than the internal JS function name (e.g., "greet(name)").
						baseModuleContainer.doclet.anchor = t.doclet.anchor || baseModuleContainer.doclet.anchor;
						baseModuleContainer.doclet.anchorSmart = t.doclet.anchorSmart || baseModuleContainer.doclet.anchorSmart;
						// Preserve the module's normalizedMemberof (root modules have no parent) to prevent
						// the function's own memberof ("module:@cldmv/slothlet") from creating a
						// self-referencing loop in simpleNameFromChain and a broken Kind parent link.
						baseModuleContainer.doclet.normalizedMemberof = t.doclet.normalizedMemberof || "";
						// Use baseModuleName as the display name (e.g., "api_test") — the root callable
						// function's internal JS name (e.g., "greet") is not meaningful to API consumers.
						baseModuleContainer.doclet.simpleName = baseModuleName || t.doclet.simpleName || baseModuleContainer.doclet.simpleName;
						baseModuleContainer.doclet.simpleNameShort =
							baseModuleName || t.doclet.simpleNameShort || baseModuleContainer.doclet.simpleNameShort;
					} else {
						// console.log(`[DIRECT] ${doclet.name} (alias: ${doclet.alias}) -> baseModule: "${baseModuleWithoutPrefix}" -> key: "${aliasPath}"`);
						baseModuleContainer.children[aliasPath] = {
							type: "direct",
							doclet: doclet,
							children: {}
						};
					}
				}
			} else {
				// Items without aliases but with dotted names need namespace structure
				// Remove base module prefix to get the path: "api_test.advanced.nest" -> "advanced.nest"
				let path = doclet.name;
				const baseModuleWithoutPrefix = baseModuleLongname.replace(/^module:/, "");

				if (path.startsWith(baseModuleWithoutPrefix + ".")) {
					path = path.replace(baseModuleWithoutPrefix + ".", "");
				}

				// console.log(`[DEBUG] Processing ${doclet.name}, baseModule: ${baseModuleWithoutPrefix}, resulting path: "${path}"`);

				if (path.includes(".")) {
					const pathParts = path.split(".");
					// console.log(`[NESTED] ${doclet.name} -> path: ${pathParts.join(' -> ')}`);

					// Create nested structure under the base module
					let current = baseModuleContainer.children;
					for (let i = 0; i < pathParts.length; i++) {
						const part = pathParts[i];
						const isLast = i === pathParts.length - 1;

						if (!current[part]) {
							// Build namespace path for auto-generation
							const namespacePath = pathParts.slice(0, i + 1);
							const fullNamespacePath = `${baseModuleLongname.replace("module:", "")}.${namespacePath.join(".")}`;
							const baseModuleName = baseModuleLongname.replace("module:", "");

							current[part] = {
								type: isLast ? "item" : "namespace",
								doclet: isLast ? doclet : functions.missingNamespace(fullNamespacePath, baseModuleName),
								children: {}
							};
						} else if (isLast) {
							// Update existing namespace to be an item
							current[part].type = "item";
							current[part].doclet = doclet;
						}

						current = current[part].children;
					}
				} else {
					// Simple name without dots
					// console.log(`[SIMPLE] ${doclet.name}`);
					baseModuleContainer.children[path] = {
						type: "item",
						doclet: doclet,
						children: {}
					};
				}
			}
			nestedStructure[baseModuleName] = baseModuleContainer;
		});

		// STEP 2: Process children of all items (direct and nested)
		// console.log('\n[PROCESSING CHILDREN OF ALL ITEMS]');

		function processChildrenRecursive(structure, path = "", level = 0) {
			Object.keys(structure).forEach((key) => {
				const item = structure[key];
				const fullPath = path ? `${path}.${key}` : key;

				// Also process 'child' type items (sub-namespaces like logger.utils) so their
				// own children (debug, error) can be discovered and attached recursively.
				// Guard: skip items whose alias IS the base module root (e.g., greet with
				// @alias module:api_test) to prevent them from re-collecting all top-level
				// children when they appear as a 'child' of rootFunction, which would loop.
				if (
					(item.type === "direct" || item.type === "item" || item.type === "child") &&
					item.doclet &&
					item.doclet.alias !== baseModuleLongname
				) {
					// For items with aliases, use the alias to find the module that contains the children
					let itemModule;
					if (item.doclet.alias) {
						// If this function replaces the base module, children have memberof pointing to this alias
						itemModule = item.doclet.alias.replace(/^module:/, "");

						// For base module items, children are in the module named after the alias
						if (item.doclet.alias.startsWith(baseModuleLongname + ".")) {
							const baseModuleWithoutPrefix = baseModuleLongname.replace(/^module:/, "");
							const itemName = item.doclet.alias.replace(baseModuleLongname + ".", "");
							itemModule = baseModuleWithoutPrefix + "." + itemName;
						}
					}
					//  else {
					// 	itemModule = item.doclet.normalizedLongname.replace(/^api_test\./, "api_test.");
					// }

					// console.log(`[CHILDREN] Looking for children of ${fullPath} with memberof: module:${itemModule}`);

					// Dot-notation sub-modules (e.g., math/math.mjs) have members with raw memberof
					// like "api_test.module:math" which normalization collapses to "module:api_test".
					// We must also match against that raw pattern to find their children.
					const baseNameForChildren = baseModuleLongname.replace(/^module:/, "");
					const dotNotationMemberof = item.doclet.name ? `${baseNameForChildren}.module:${item.doclet.name}` : null;

					sortedDoclets.forEach((doclet) => {
						const matchesByNormalized = doclet.normalizedMemberof === "module:" + itemModule;
						const matchesByDotNotation = dotNotationMemberof && doclet.memberof === dotNotationMemberof;
						if ((matchesByNormalized || matchesByDotNotation) && doclet.id !== item.doclet.id) {
							// doclet.level = level + 1;
							// console.log(`[CHILD] Found child ${doclet.name} (${doclet.kind}) for ${fullPath}`);
							item.children[doclet.name] = {
								type: "child",
								doclet: doclet,
								children: {}
							};
						}
					});
				}

				// Recursively process nested items
				if (item.children) {
					processChildrenRecursive(item.children, fullPath, level + 1);
				}
			});
		}

		processChildrenRecursive(nestedStructure);

		// console.log('\n[NESTED STRUCTURE]');
		// console.dir(nestedStructure, { depth: 4 });
		// process.exit(0);

		// console.dir(topLevelDoclets, { depth: 1 });
		// console.log("topLevelDoclets.length", topLevelDoclets.length);
		// console.dir(exportedConstants, { depth: 1 });

		// return nestedStructure;

		// Separate into the 3 essential categories
		// Constants: extract constants from the nested structure
		const constants = [];
		const typedefs = [];

		const allTypedefs = doclets.filter((doclet) => doclet.kind === "typedef").map((doclet) => functions.processDoclet(doclet));

		allTypedefs.forEach((doclet) => {
			if (doclet.doclet) {
				doclet.doclet = functions.applySimpleName(doclet.doclet);
				docletData.set(doclet.doclet.normalizedId || doclet.doclet.normalizedLongname, doclet.doclet);
			} else {
				doclet = functions.applySimpleName(doclet);
				docletData.set(doclet.normalizedId || doclet.normalizedLongname, doclet);
			}
		});

		const globalTypedefs = allTypedefs.filter((doclet) => doclet.scope === "global");

		// Helper function to extract const/typedefs from nested structure
		function extractRecursive(structure, level = 0) {
			Object.keys(structure).forEach((key) => {
				const item = structure[key];

				if (item.doclet) {
					item.doclet.level = level;
					docletData.set(item.doclet.normalizedId || item.doclet.normalizedLongname, item.doclet);
				}

				if ((item.type === "direct" || item.type === "item") && item.doclet) {
					// items.push(item);
					// Check if it's a constant without alias (direct module member)
					if (item.doclet.kind === "constant" && !item.doclet.alias && item.doclet.normalizedMemberof === baseModuleLongname) {
						constants.push(item);
					}
					// Check if it's a typedef
					if (item.doclet.kind === "typedef") {
						const typedef = allTypedefs.find(
							(td) =>
								td.name === item.doclet.name &&
								// (!td.memberof || td.scope === "global") &&
								!typedefs.find((gt) => gt.normalizedId === td.normalizedId)
						);
						if (typedef) {
							typedefs.push(item);
						}
					}
				}

				// Check parameter types
				if (item?.doclet?.params) {
					item.doclet.params.forEach((param) => {
						if (param.type && param.type.names) {
							param.type.names.forEach((typeName) => {
								const typedef = allTypedefs.find(
									(td) =>
										td.name === typeName &&
										// (!td.memberof || td.scope === "global") &&
										!typedefs.find((gt) => gt.normalizedId === td.normalizedId)
								);
								if (typedef) {
									typedefs.push(typedef);
								}
							});
						}
					});
				}

				if (item?.doclet?.returns) {
					item.doclet.returns.forEach((returnInfo) => {
						if (returnInfo.type && returnInfo.type.names) {
							returnInfo.type.names.forEach((typeName) => {
								// Extract bare names from generic wrappers like "Promise.<SlothletAPI>"
								// so that the inner typedef ("SlothletAPI") is still matched.
								const candidateNames = [typeName];
								const inner = typeName.match(/\.<([^>]+)>$/);
								if (inner) candidateNames.push(inner[1]);

								candidateNames.forEach((name) => {
									// Find global typedef with this name
									const typedef = allTypedefs.find(
										(td) =>
											td.name === name &&
											// (!td.memberof || td.scope === "global") &&
											!typedefs.find((gt) => gt.normalizedId === td.normalizedId)
									);
									if (typedef) {
										typedefs.push(typedef);
									}
								});
							});
						}
					});
				}

				// Recursively process children
				if (item.children) {
					extractRecursive(item.children, level + 1);
				}
			});
		}

		// Helper function to set simple names in nested structure
		function setSimpleNameRecursive(structure) {
			Object.keys(structure).forEach((key) => {
				const item = structure[key];

				if (item.doclet) {
					item.doclet = functions.applySimpleName(item.doclet);
					docletData.set(item.doclet.normalizedId || item.doclet.normalizedLongname, item.doclet);
				}

				// Recursively process children
				if (item.children) {
					setSimpleNameRecursive(item.children);
				}
			});
		}

		// const allNestedItems = extractItemsRecursive(nestedStructure);
		extractRecursive(nestedStructure);

		// Register the base module root under both its bare name and the "module:" prefixed name
		// so that @memberof module:X lookups in getParentDoclet can always resolve the parent.
		//
		// Background: jsdoc sub-module files that declare `@module api_test.advanced.selfObject`
		// produce doclets with `normalizedMemberof = "module:api_test"` (the short unqualified name
		// from the @module tag, NOT the full @alias path like "@cldmv/slothlet/api_tests/api_test").
		// When simpleNameFromChain walks the parent chain for the "advanced" namespace, it calls
		// getParentDoclet("module:api_test") which misses the docletData entry (stored under the
		// full normalized id). Registering both "api_test" and "module:api_test" here closes that gap.
		//
		// We also correct the doclet's name to baseModuleName (rather than the internal callable
		// function name e.g. "greet") so the chain produces "api_test.advanced" not "greet.advanced".
		const baseModuleShortName = baseModuleName.split("/").pop();
		{
			const baseModRootItem = nestedStructure[baseModuleName];
			if (baseModRootItem?.doclet) {
				if (baseModRootItem.doclet.name !== baseModuleName) {
					baseModRootItem.doclet.name = baseModuleName;
				}
				const moduleRootDoclet = baseModRootItem.doclet;
				docletData.set(baseModuleName, moduleRootDoclet);
				docletData.set("module:" + baseModuleName, moduleRootDoclet);
				if (baseModuleShortName && baseModuleShortName !== baseModuleName) {
					docletData.set(baseModuleShortName, moduleRootDoclet);
					docletData.set("module:" + baseModuleShortName, moduleRootDoclet);
				}
			}
		}

		setSimpleNameRecursive(nestedStructure);

		// Post-simpleName pass: if a root callable function (alias === baseModuleLongname) has
		// replaced the base module container, restore the module name as the display name.
		// applySimpleName (called inside setSimpleNameRecursive) would overwrite with the JS
		// function's internal name (e.g., "greet"), so we re-apply the module name here.
		const baseModItem = nestedStructure[baseModuleName];
		if (baseModItem && baseModItem.doclet && baseModItem.doclet.alias === baseModuleLongname) {
			baseModItem.doclet.simpleName = baseModuleName;
			baseModItem.doclet.simpleNameShort = baseModuleName;
		}

		// Detect global typedefs that are referenced by this module's functions
		// const globalTypedefs = [];

		// console.log(allTypedefs);
		// process.exit(0);

		// typedefs.forEach((doclet) => {
		// 	functions.applyAnchor(doclet);
		// });
		// typedefs.map((doclet) => functions.applyAnchor(doclet));

		// console.log('\n[NESTED STRUCTURE]');
		// console.dir(nestedStructure, { depth: 3 });
		// console.log(`[DEBUG] baseModuleLongname: "${baseModuleLongname}", starting with base module container`);
		// process.exit(0);
		const r = {
			// The 3 essential pieces you requested
			items: nestedStructure,
			constants,
			typedefs,
			anchorMap,
			// Global typedefs referenced by this module
			globalTypedefs,
			// Base data
			// baseModule: null, // No longer using hierarchyResult
			baseModuleLongname,
			baseModuleName
		};

		// console.dir(r, { depth: 5, colors: true });
		// process.exit(0);

		// Return the clean structure with only essential data
		return r;

		// STEP 3: Detect pattern type and process accordingly
		// const isSlothletPattern = baseModuleName.includes("@cldmv/slothlet");

		// if (isSlothletPattern) {
		// 	// For slothlet, use specialized processing to handle -- memberof patterns
		// 	return this.processSlothletDoclets(sortedDoclets, baseModuleLongname, baseModuleName, winningFunctions);
		// } else {
		// 	return this.processSimpleDoclets(sortedDoclets, baseModuleLongname, baseModuleName, winningFunctions);
		// }
	},

	// Get function name with namespace prefix (e.g., "mathEsm.add")
	// functionDisplayName(funcDoc, namespaceDoc) {
	// 	if (!funcDoc || !namespaceDoc) return funcDoc?.name || "";
	// 	return `${namespaceDoc.name}.${funcDoc.name}`;
	// }
	// Auto-detect code language from file extension or context
	detectCodeLanguage(doclet) {
		// Check if the doclet has file information
		if (doclet && doclet.meta && doclet.meta.filename) {
			const filename = doclet.meta.filename.toLowerCase();

			// Map file extensions to language identifiers
			if (filename.endsWith(".mjs") || filename.endsWith(".js")) return "js";
			if (filename.endsWith(".cjs")) return "js";
			if (filename.endsWith(".ts")) return "ts";
			if (filename.endsWith(".mts")) return "ts";
			if (filename.endsWith(".cts")) return "ts";
			if (filename.endsWith(".jsx")) return "jsx";
			if (filename.endsWith(".tsx")) return "tsx";
			if (filename.endsWith(".json")) return "json";
			if (filename.endsWith(".md")) return "markdown";
			if (filename.endsWith(".html")) return "html";
			if (filename.endsWith(".css")) return "css";
			if (filename.endsWith(".scss") || filename.endsWith(".sass")) return "scss";
			if (filename.endsWith(".py")) return "python";
			if (filename.endsWith(".sh")) return "bash";
			if (filename.endsWith(".yaml") || filename.endsWith(".yml")) return "yaml";
			if (filename.endsWith(".xml")) return "xml";
		}

		// Default fallback for JavaScript-like projects
		return "js";
	},

	// Hierarchical Module Support Functions

	/**
	 * Detect parent-child relationships in module names
	 * @param {string} childModule - Potential child module name
	 * @param {string} parentModule - Potential parent module name
	 * @returns {boolean} True if childModule is a child of parentModule
	 */
	isChildModule(childModule, parentModule) {
		if (!childModule || !parentModule) return false;
		const cleanChild = childModule.replace(/^module:/, "");
		const cleanParent = parentModule.replace(/^module:/, "");

		// Child must start with parent name followed by '/'
		return cleanChild.startsWith(cleanParent + "/") && cleanChild !== cleanParent;
	},

	/**
	 * Determine if typedefs should be shared between child and parent modules
	 * @param {string} childModule - Child module name
	 * @param {string} parentModule - Parent module name
	 * @returns {boolean} True if typedefs should be shared
	 */
	shouldShareTypedefs(childModule, parentModule) {
		return functions.isChildModule(childModule, parentModule);
	},

	// Shared sorting function for consistent TOC and content ordering
	sortHierarchyItems(hierarchyEntries) {
		return hierarchyEntries.sort((a, b) => {
			let _;
			let itemA;
			let itemB;
			[_, itemA] = a;
			[_, itemB] = b;

			// Check for explicit order (either on doc or directly on item)
			const orderA = itemA.doc?.order ?? itemA.order;
			const orderB = itemB.doc?.order ?? itemB.order;
			if (orderA !== undefined && orderB !== undefined) {
				return orderA - orderB;
			}
			if (orderA !== undefined) return -1;
			if (orderB !== undefined) return 1;

			// Sort by hierarchy level first (parents before children)
			if (itemA.level !== itemB.level) {
				return itemA.level - itemB.level;
			}

			// Within the same level, preserve JSDoc doclet order (original processing order)
			const indexA = itemA.docletIndex ?? Number.MAX_SAFE_INTEGER;
			const indexB = itemB.docletIndex ?? Number.MAX_SAFE_INTEGER;
			return indexA - indexB;
		});
	},

	// Shared hierarchy building logic for both TOC and content generation
	buildSharedHierarchy(doclets, baseModuleLongname) {
		const hierarchy = new Map();

		// First pass: collect all modules to understand the full hierarchy
		const allModules = doclets.filter((doc) => doc.kind === "module" && doc.longname !== baseModuleLongname && helper.shouldInclude(doc));

		// Second pass: process modules and create namespaces with proper ordering
		doclets.forEach((doc, docletIndex) => {
			if (doc.kind === "module" && doc.longname !== baseModuleLongname) {
				// Skip package/private/internal modules unless --private or --package flag is set
				if (!helper.shouldInclude(doc)) {
					return; // Skip this module
				}

				// Handle slothlet-specific module naming pattern: "@cldmv/slothlet.helpers.module:cjs-integration"
				// Slash-separated modules like "@cldmv/slothlet/runtime" are separate modules, not nested
				const baseName = baseModuleLongname.replace(/^module:/, ""); // "@cldmv/slothlet"
				if (doc.longname.startsWith(baseName + ".")) {
					// Extract the path like "helpers.module:cjs-integration" from "@cldmv/slothlet.helpers.module:cjs-integration"
					const separator = ".";
					const suffix = doc.longname.substring(baseName.length + 1); // Remove "@cldmv/slothlet."

					// Parse patterns like "helpers.module:cjs-integration" -> ["helpers", "cjs-integration"]
					// or "advanced.nest2.module:alpha" -> ["advanced", "nest2", "alpha"]
					// or "module:runtime" -> ["runtime"] or "runtime" -> ["runtime"]
					let relativeParts;
					if (suffix.includes(".module:")) {
						const [namespace, moduleName] = suffix.split(".module:");
						// Split namespace on dots to get proper hierarchy: "advanced.nest2" -> ["advanced", "nest2"]
						const namespaceParts = namespace.split(".");
						relativeParts = [...namespaceParts, moduleName];
					} else if (suffix.startsWith("module:")) {
						relativeParts = [suffix.substring("module:".length)];
					} else if (separator === "/") {
						// Handle slash-separated paths like "runtime"
						relativeParts = suffix.split("/").filter(Boolean);
					} else {
						relativeParts = suffix.split(".");
					}

					// Create intermediate namespace objects FIRST (like "helpers", "modes")
					// so they appear in insertion order before their children
					if (relativeParts.length > 1 && helper.shouldInclude(doc)) {
						for (let i = 1; i < relativeParts.length; i++) {
							const intermediatePath = relativeParts.slice(0, i);
							const intermediateKey = intermediatePath.join(".");
							const intermediateName = relativeParts[i - 1];

							if (!hierarchy.has(intermediateKey)) {
								// Find the minimum order of all modules that will belong to this namespace
								let minChildOrder = Number.MAX_SAFE_INTEGER;
								let hasChildren = false;

								for (const childModule of allModules) {
									if (childModule.longname.startsWith(baseName + "." + intermediateKey + ".")) {
										hasChildren = true;
										const childOrder = childModule.order !== undefined ? childModule.order : 0;
										minChildOrder = Math.min(minChildOrder, childOrder);
									}
								}

								// Set namespace order to be before its children
								const namespaceOrder = hasChildren ? minChildOrder - 1 : undefined;

								hierarchy.set(intermediateKey, {
									type: "namespace",
									name: intermediateName,
									path: intermediatePath,
									level: intermediatePath.length,
									order: namespaceOrder,
									sortKey: `${intermediatePath.length}_${intermediateKey}`,
									docletIndex: docletIndex // Add JSDoc order preservation
								});
							}
						}
					}

					// Create the module entry AFTER creating its parent namespaces
					const moduleKey = relativeParts.join(".");
					hierarchy.set(moduleKey, {
						type: "module",
						doc: doc,
						path: relativeParts,
						level: relativeParts.length,
						// Use the actual JSDoc order (don't override it)
						sortKey: `${relativeParts.length}_${moduleKey}`,
						docletIndex: docletIndex // Add JSDoc order preservation
					});
				}
			} else if (doc.kind === "constant") {
				// Skip private/internal constants unless --private or --package flag is set
				if (!helper.shouldInclude(doc)) {
					return; // Skip this constant
				}

				const normalizedMemberof = format.normalizeMemberof(doc.memberof);

				if (normalizedMemberof === baseModuleLongname) {
					// Direct member of this module (could be base module or any other module)
					// Handle exports (constants with -- pattern) for slash-separated modules like runtime
					if (doc.memberof && doc.memberof.includes("--")) {
						// Extract the export pattern - check if it's a direct export of this module
						const beforeDash = doc.memberof.split("--")[0];
						const afterDash = doc.memberof.split("--")[1];
						const normalizedBefore = format.normalizeMemberof(beforeDash);

						// If the export belongs to this module (e.g., module:@cldmv/slothlet/runtime--@cldmv/slothlet/runtime)
						if (normalizedBefore === baseModuleLongname && afterDash === baseModuleLongname.replace(/^module:/, "")) {
							hierarchy.set(doc.name, {
								type: "constant",
								doc: doc,
								path: [doc.name],
								level: 1,
								sortKey: `1_${doc.name}`
							});
						}
					} else {
						// Regular constants without -- pattern
						hierarchy.set(doc.name, {
							type: "constant",
							doc: doc,
							path: [doc.name],
							level: 1,
							sortKey: `1_${doc.name}`
						});
					}
				} else if (normalizedMemberof && normalizedMemberof.startsWith(baseModuleLongname + ".")) {
					// Nested member - extract the intermediate path (only for dot-separated)
					const memberofClean = normalizedMemberof.replace(/^module:/, "");
					const baseClean = baseModuleLongname.replace(/^module:/, "");

					// Use dot separator for nested members
					const separator = ".";
					const baseParts = baseClean.split(separator);
					const memberofParts = memberofClean.split(separator);

					// Get the path relative to base module
					const relativeParts = memberofParts.slice(baseParts.length);

					// Create intermediate objects for each level
					for (let i = 0; i < relativeParts.length; i++) {
						const intermediatePath = relativeParts.slice(0, i + 1);
						const intermediateKey = intermediatePath.join(".");
						const intermediateName = relativeParts[i];

						if (!hierarchy.has(intermediateKey)) {
							hierarchy.set(intermediateKey, {
								type: "pseudo-object",
								name: intermediateName,
								path: intermediatePath,
								level: i + 1,
								sortKey: `${i + 1}_${intermediateKey}`
							});
						}
					}

					// Add the constant directly under its immediate parent namespace
					const constantPath = [...relativeParts, doc.name];
					const constantKey = constantPath.join(".");
					hierarchy.set(constantKey, {
						type: "constant",
						doc: doc,
						path: constantPath,
						level: relativeParts.length + 1,
						parent: relativeParts.join("."),
						sortKey: `${relativeParts.length + 1}_${constantKey}`
					});
				}
			}
		});

		return hierarchy;
	},

	/**
	 * Creates a missing namespace doclet for auto-generation when namespace exists but has no doclet.
	 * Similar to missingRootModule but for intermediate namespaces.
	 * @param {string} namespaceName - Full namespace path (e.g., "api_test_mixed.advanced")
	 * @param {string} baseModuleName - Base module name (e.g., "api_test_mixed")
	 * @returns {object} Auto-generated namespace doclet
	 */
	missingNamespace(namespaceName, baseModuleName) {
		// Extract the last part of the namespace for display
		const namespaceDisplayName = namespaceName.split(".").pop() || namespaceName;

		// Determine the parent memberof based on the namespace depth
		// For "api_test.advanced" → memberof: "module:api_test"
		// For "api_test.advanced.nest" → memberof: "module:api_test.advanced"
		const namespaceParts = namespaceName.split(".");
		let memberof;
		if (namespaceParts.length === 2) {
			// Direct child of base module: api_test.advanced
			memberof = `module:${baseModuleName}`;
		} else {
			// Nested namespace: api_test.advanced.nest
			const parentNamespace = namespaceParts.slice(0, -1).join(".");
			memberof = `module:${parentNamespace}`;
		}

		let r = {
			kind: "namespace",
			longname: `module:${namespaceName}`,
			name: namespaceDisplayName,
			memberof: memberof,
			id: namespaceName,
			description: `Auto-generated namespace for ${namespaceDisplayName} components.`,
			summary: `<em>This namespace was automatically generated.</em> Contains ${namespaceDisplayName} related functionality.`,
			examples: [
				// `// Access ${namespaceDisplayName} functions via ${baseModuleName} API\nconst ${baseModuleName} = await slothlet({ dir: './${baseModuleName}' });\n// Use ${baseModuleName}.${namespaceDisplayName}.functionName()`
			],
			meta: {
				filename: "auto-generated",
				lineno: 1,
				columnno: 1,
				path: "auto-generated"
			}
		};
		r = functions.processDoclet(r);
		// if (namespaceDisplayName !== "advanced") {
		// 	console.log(r);
		// 	process.exit(0);
		// }
		return r;
	},

	getParentDoclet(normalizedMemberof) {
		let parentDoclet = docletData.get(normalizedMemberof);

		if (!parentDoclet) {
			if (normalizedMemberof.startsWith("module_") || normalizedMemberof.startsWith("module:")) {
				normalizedMemberof = normalizedMemberof.substring(7); // Remove "module_" (7 characters)
			}
			parentDoclet = docletData.get(normalizedMemberof);
		}

		let parentDocletLongName = "";
		if (parentDoclet) {
			parentDocletLongName = parentDoclet.normalizedLongname;
			if (parentDocletLongName.startsWith("module_") || parentDocletLongName.startsWith("module:")) {
				parentDocletLongName = parentDocletLongName.substring(7); // Remove "module_" (7 characters)
			}
		}

		return { ...parentDoclet, parentDocletLongName };
	}
};

const partials = {
	/**
	 * Renders exported constants (with -- in memberof) as full documentation blocks for any section.
	 * @param {Array} doclets - All JSDoc doclets
	 * @param {object} item - The current hierarchy item (module, pseudo-object, etc.)
	 * @param {string} baseModuleName - The base module name
	 * @param {string} moduleName - The current module name (may be undefined for some types)
	 * @param {string} output - The output string to append to
	 * @returns {string} Updated output string
	 */
	exportedConstantsBlock(constants, output, baseModuleName, baseModuleLongname) {
		constants.forEach((constant) => {
			output += `\n* * *\n\n`;
			// const encodedConstantName = format.generateAnchor(constant.doclet?.name);
			// output += `<a id="${format.generateAnchor(constant.doclet?.id || constant.doclet?.name)}_dot_${encodedConstantName}"></a>\n\n`;
			const constHeadingLevel = "#".repeat(constant.doclet?.name ? Math.min(4 + (constant.level || 0) - 1, 6) : 4);
			const typeInfo =
				constant.doclet?.type && constant.doclet.type.names ? ` : <code>${constant.doclet.type.names.join(" | ")}</code>` : "";
			const constantName = constant.doclet?.simpleName || constant.doclet?.name || "unknown";
			output += `${constHeadingLevel} ${constantName}${typeInfo}\n`;
			output += `${constant.doclet?.description || ""}\n\n`;

			// Add Kind line matching baseline format using dmd standard patterns
			output += partials.kind(constant, baseModuleName, baseModuleLongname);

			output = partials.examples(constant.doclet || constant, output);
		});
		return output;
	},

	kind(item) {
		let normalizedMemberof = item?.normalizedMemberof || item?.doclet?.normalizedMemberof;
		if (!normalizedMemberof) return "";

		let output = "";
		const parentDoclet = functions.getParentDoclet(normalizedMemberof);

		// Add Kind line matching baseline format using dmd standard patterns
		// if (!parentDoclet) {
		// 	console.dir(docletData, { depth: 0 });
		// 	console.log("kind item: ", item);
		// 	console.log(normalizedMemberof);
		// 	process.exit(0);
		// 	return "";
		// }

		const kindDescription = format.getKindInThisContext(item?.doclet || item);
		const scope = item?.scope || item?.doclet?.scope || "static";
		// const baseModuleAnchor = format.generateAnchor(baseModuleLongname);
		output += `**Kind**: ${scope} ${kindDescription}`;
		if (parentDoclet) {
			// Prefer simpleName (set by setSimpleNameRecursive) over parentDocletLongName which is
			// derived from normalizedLongname and may include internal callable names like
			// "api_test.rootFunction.greet" instead of the clean module name "api_test".
			const parentDisplayName = parentDoclet.simpleName || parentDoclet.parentDocletLongName;
			output += ` of [<code>${parentDisplayName}</code>](#${parentDoclet.anchor})\n\n`;
		}
		return output;
	},

	returns(func, output) {
		if (func.returns) {
			const returnsDesc = format.returnsDesc(func.returns);
			output += `**Returns**:\n\n`;
			output += `- <code>${format.typeForTableWithLinks(func.returns[0].type)}</code> <p>${returnsDesc || ""}</p>\n`;
			output += "\n\n";
		}
		return output;
	},

	throws(func, output) {
		if (func.exceptions && func.exceptions.length > 0) {
			output += `**Throws**:\n\n`;
			func.exceptions.forEach((exc) => {
				output += `- <code>${format.typeForTableWithLinks(exc.type)}</code> ${exc.description || ""}\n`;
			});
			output += "\n\n";
		}
		return output;
	},

	params(func, output, moduleId, availableTypedefs) {
		if (func.params && func.params.length > 0) {
			output += `\n| Param | Type | Default | Description |\n`;
			output += `| --- | --- | --- | --- |\n`;
			func.params.forEach((param) => {
				// Handle parameter name with optional brackets
				const paramName = param.optional ? `[${param.name}]` : param.name;

				// Get default value if available
				const defaultValue = param.defaultvalue !== undefined ? `<code>${param.defaultvalue}</code>` : "";

				// Collapse newlines so multi-line HTML descriptions (ul/li etc.) don't break table rows
				const paramDesc = (param.description || "").replace(/\r?\n/g, " ").replace(/\s{2,}/g, " ");
				output += `| ${paramName} | <code>${format.typeForTableWithLinks(param.type, moduleId, availableTypedefs)}</code> | ${defaultValue} | ${paramDesc} |\n`;
			});
			output += "\n\n";
		}
		return output;
	},

	description(doclet, summary = false) {
		// {{#if description}}<p><strong style="font-size: 1.1em;">{{{description}}}</strong></p>{{/if}}
		// {{#if summary}}{{{summary}}}{{/if}}
		let output = "";
		if (summary && doclet.summary) {
			output += `${doclet.summary}\n`;
		} else if (doclet.description || doclet.descriptionBackup) {
			output += `<p><strong style="font-size: 1.1em;">${doclet.descriptionBackup || doclet.description}</strong></p>\n`;
		}
		output = "> " + output.replace(/\n/g, "\n> ") + "\n";
		return output;
	},

	examples(func, options) {
		// Handle both direct calls (with string output) and Handlebars calls (with context object)
		let output = "";
		if (typeof options === "string") {
			output = options;
		} else if (options && typeof options === "object" && options.name) {
			// This is a Handlebars context object, ignore it
			output = "";
		}

		const funcExamples = func.examplesBackup || func.examples;

		if (funcExamples && funcExamples.length > 0) {
			// Auto-detect code language for this doclet
			const codeLanguage = functions.detectCodeLanguage(func);

			funcExamples.forEach((example, _) => {
				// Find all GitHub alerts and their content
				const lines = example.split("\n");
				const extractedAlerts = [];
				let currentAlert = null;
				let alertContent = [];
				let codeSegments = [];
				let currentCodeSegment = [];

				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					const alertMatch = line.match(/^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/);
					const contentMatch = line.match(/^\s*>\s*(?!\[!)(.+)$/);

					if (alertMatch) {
						// Finish current code segment if exists
						if (currentCodeSegment.length > 0) {
							codeSegments.push(currentCodeSegment.join("\n"));
							currentCodeSegment = [];
						}

						// Save previous alert if exists
						if (currentAlert) {
							extractedAlerts.push({
								type: currentAlert,
								content: alertContent.join("\n").trim()
							});
						}
						// Start new alert
						currentAlert = alertMatch[1];
						alertContent = [];
					} else if (contentMatch && currentAlert) {
						// Add content to current alert
						alertContent.push(contentMatch[1]);
					} else if (currentAlert && line.match(/^\s*>\s*$/)) {
						// Empty alert line - keep it
						alertContent.push("");
					} else {
						// Save current alert if exists and switch to code
						if (currentAlert) {
							extractedAlerts.push({
								type: currentAlert,
								content: alertContent.join("\n").trim()
							});

							// Start new code segment
							currentCodeSegment = [];
							currentAlert = null;
							alertContent = [];
						}
						// Regular code line
						currentCodeSegment.push(line);
					}
				}

				// Save final code segment
				if (currentCodeSegment.length > 0) {
					codeSegments.push(currentCodeSegment.join("\n"));
				}

				// Save final alert if exists
				if (currentAlert) {
					extractedAlerts.push({
						type: currentAlert,
						content: alertContent.join("\n").trim()
					});
				}

				// If no alerts were found, treat the whole example as one code block
				if (extractedAlerts.length === 0) {
					output += `**Example**\n\`\`\`${codeLanguage}\n${example.trim()}\n\`\`\`\n`;
				} else {
					// Render interspersed code segments and alerts
					let segmentIndex = 0;

					// If we have a code segment before any alerts, render it first
					if (codeSegments.length > 0 && codeSegments[0].trim()) {
						output += `**Example**\n\`\`\`${codeLanguage}\n${codeSegments[segmentIndex].trim()}\n\`\`\`\n`;
						segmentIndex++;
					}

					// Render alerts and any following code segments
					extractedAlerts.forEach((alert) => {
						// Render the alert
						output += `\n> [!${alert.type}]\n`;
						const contentLines = alert.content.split("\n");
						contentLines.forEach((line) => {
							output += `> ${line}\n`;
						});
						output += "\n";

						// Render next code segment if it exists
						if (segmentIndex < codeSegments.length && codeSegments[segmentIndex].trim()) {
							output += `\`\`\`${codeLanguage}\n${codeSegments[segmentIndex].trim()}\n\`\`\`\n`;
						}
						segmentIndex++;
					});
				}
			});
			output += "\n\n";
		}
		return output;
	},

	tocTreeOutput(doclet, item, indent, prefix) {
		let output = "";
		let params = doclet.params ? `(${format.paramsForTOC(doclet.params)})` : "";
		if (!params && doclet.kind === "function") {
			params = "()";
		}
		const returns = doclet.returns ? ` ⇒ ${format.returnsForTOC(doclet.returns)}` : "";
		let anchor = item.anchor || doclet.anchor;
		if (doclet.level === 0) {
			anchor = item.anchorSmart || doclet.anchorSmart;
		}
		const name = item.simpleNameShort || doclet.simpleNameShort || item.simpleName || doclet.simpleName;
		output += `${indent}${prefix}[${name}${params}](#${anchor})${returns}\n`;
		return output;
	},

	/**
	 * Global typedef definitions - appears at the end of the document
	 * Collects ALL typedefs regardless of module and displays them in a single section
	 * Uses the global availableTypedefs array with structure:
	 * [{ id, longname, name, kind, scope, type, properties, meta, order, normalizedMemberof, normalizedLongname, normalizedId, simpleName, anchor }]
	 * @param {*} _ - Unused Handlebars options
	 * @returns {string} Global typedef definitions section
	 */
	globalTypedefDefinitions() {
		// If integratedModules already rendered typedefs inline inside the main module,
		// skip the standalone section entirely.
		if (slothletTypedefsInlined) return "";
		if (!Array.isArray(availableTypedefs) || availableTypedefs.length === 0) return "";

		let output = "\n\n* * *\n\n";
		output += "## Type Definitions\n\n";

		availableTypedefs.forEach((typedef) => {
			// Use the pre-computed anchor from the typedef object
			const anchor = typedef.anchor || helper.generateAnchor(typedef.id || typedef.name);
			output += `<a id="${anchor}"></a>\n\n`;

			const headingLevel = "###"; // h3 for typedefs
			const typeInfo = typedef.type && typedef.type.names ? ` : <code>${typedef.type.names.join(" | ")}</code>` : "";

			output += `${headingLevel} ${typedef.simpleName || typedef.name}${typeInfo}\n`;
			output += `${typedef.description || ""}\n\n`;
			output += `**Kind**: typedef  \n`;
			output += `**Scope**: ${typedef.scope || "global"}\n\n`;

			// Add properties: split into table-rendered (non-function) and section-rendered (function)
			if (typedef.properties && typedef.properties.length > 0) {
				// Helper: build per-property anchor (same format as before so structure-tree links still resolve)
				const propAnchorFor = (prop) => {
					const rawPropName = prop.name.replace(/^\[|\]$/g, "");
					return `${anchor}_prop_${rawPropName.replace(/\./g, "-")}`;
				};

				const isFunction = (prop) => prop.type && prop.type.names && prop.type.names.some((n) => /^function\s*(?:\(|$)/i.test(n));

				/**
				 * Parse a typed function signature from the %%sig: (params): ReturnType%% marker.
				 * e.g. "(apiPath: string, folderPath: string, [options]: Object): Promise.<void>"
				 * @param {string} sigStr - Content of %%sig: ...%%
				 * @returns {{params: Array, returnType: string|null}|null}
				 */
				function parseFunctionSig(sigStr) {
					const match = sigStr.match(/^\(([^)]*)\)\s*(?::\s*(.+))?$/);
					if (!match) return null;
					const paramsStr = match[1].trim();
					const returnType = match[2] ? match[2].trim() : null;
					const params = paramsStr
						? paramsStr
								.split(",")
								.map((s) => s.trim())
								.filter(Boolean)
								.map((p) => {
									const isOpt = p.startsWith("[");
									if (isOpt) {
										// Pattern: [name]: Type  →  name is inside brackets, type follows
										const m = p.match(/^\[([^\]]+)\]:\s*(.+)$/);
										if (m) return { name: m[1].trim(), type: { names: [m[2].trim()] }, optional: true };
										// Fallback: bracket-only wrapping with no type annotation
										const cleaned = p.replace(/^\[|\]$/g, "").trim();
										return { name: cleaned, type: { names: ["*"] }, optional: true };
									}
									const ci = p.indexOf(":");
									if (ci > -1) {
										return { name: p.slice(0, ci).trim(), type: { names: [p.slice(ci + 1).trim()] }, optional: false };
									}
									return { name: p, type: { names: ["*"] }, optional: false };
								})
						: [];
					return { params, returnType };
				}

				/**
				 * Extract a %%sig: ...%% marker from a JSDoc description string.
				 * @param {string} desc - Raw description string (may contain HTML)
				 * @returns {{ sig: string|null, cleanDesc: string }}
				 */
				function extractSigFromDesc(desc) {
					if (!desc) return { sig: null, cleanDesc: "" };
					const m = desc.match(/%%sig:\s*([^%]+)%%/);
					if (!m) return { sig: null, cleanDesc: desc };
					const cleanDesc = desc.replace(/\s*%%sig:[^%]+%%/, "").trim();
					return { sig: m[1].trim(), cleanDesc };
				}

				// Section rendering: function-type properties become #### sub-sections (rendered first)
				const fnProps = typedef.properties.filter(isFunction);
				if (fnProps.length > 0) {
					output += "\n";
					fnProps.forEach((prop) => {
						const pa = propAnchorFor(prop);
						const rawName = prop.name.replace(/^\[|\]$/g, "");
						const isOptional = prop.name.startsWith("[");
						const displayName = isOptional ? `[api.${rawName}()]` : `api.${rawName}()`;
						output += `<a id="${pa}"></a>\n\n`;
						output += `#### ${displayName}\n\n`;
						if (prop.description) {
							// Strip outer <p> tags and %%sig: ...%% markers for clean display
							const { cleanDesc } = extractSigFromDesc(prop.description.replace(/^<p>|<\/p>$/g, "").trim());
							if (cleanDesc) output += `${cleanDesc}\n\n`;
						}
						output += `**Kind**: function property of [<code>${typedef.simpleName || typedef.name}</code>](#${anchor})\n\n`;

						// Parse params and return type from the %%sig: ...%% marker in the description
						const rawDesc = prop.description || "";
						const { sig: sigStr } = extractSigFromDesc(rawDesc.replace(/^<p>|<\/p>$/g, "").trim());
						const impl = sigStr ? parseFunctionSig(sigStr) : null;

						if (impl && impl.params && impl.params.length > 0) {
							// Filter to top-level params only (no dotted sub-params in signature row)
							const hasDefaults = impl.params.some((p) => p.defaultvalue !== undefined);
							output += `| Param | Type | ${hasDefaults ? "Default | " : ""}Description |\n`;
							output += `| --- | --- | ${hasDefaults ? "--- | " : ""}--- |\n`;
							impl.params.forEach((param) => {
								const pName = param.optional ? `[${param.name}]` : param.name;
								const pType = param.type && param.type.names ? `<code>${format.typeForTableWithLinks(param.type)}</code>` : "";
								const pDesc = (param.description || "").replace(/\r?\n/g, " ").replace(/\s{2,}/g, " ");
								const pDefault = hasDefaults ? `${param.defaultvalue !== undefined ? `<code>${param.defaultvalue}</code>` : ""} | ` : "";
								output += `| ${pName} | ${pType} | ${pDefault}${pDesc} |\n`;
							});
							output += "\n";
						}

						if (impl && impl.returnType) {
							output += `**Returns**: <code>${impl.returnType}</code>\n\n`;
						}

						output += `* * *\n\n`;
					});
				}

				// Table section: non-function properties (namespaces, booleans, config values, metadata)
				const tableProps = typedef.properties.filter((p) => !isFunction(p));
				if (tableProps.length > 0) {
					const hasDefaults = tableProps.some((p) => p.defaultvalue !== undefined);
					if (hasDefaults) {
						output += "\n| Property | Type | Default | Description |\n";
						output += "| --- | --- | --- | --- |\n";
					} else {
						output += "\n| Property | Type | Description |\n";
						output += "| --- | --- | --- |\n";
					}
					tableProps.forEach((prop) => {
						const name = prop.optional ? `[${prop.name}]` : prop.name;
						const type = prop.type ? `<code>${prop.type.names.join(" | ")}</code>` : "";
						let description = prop.description ? format.escapeForTable(prop.description) : "";
						const pa = propAnchorFor(prop);
						if (hasDefaults) {
							const defaultValue = prop.defaultvalue !== undefined ? `<code>${prop.defaultvalue}</code>` : "";
							output += `| <a id="${pa}"></a>${name} | ${type} | ${defaultValue} | ${description} |\n`;
						} else {
							output += `| <a id="${pa}"></a>${name} | ${type} | ${description} |\n`;
						}
					});
					output += "\n";
				}
			}

			output = partials.examples(typedef, output);

			output += `\n* * *\n\n`;
		});

		return output;
	},

	// Auto-generate root module when missing
	missingRootModule(doclets) {
		// Extract base module name from memberof patterns
		let baseModuleName = null;

		// Look for patterns like "module:api_test_cjs" or "api_test_cjs" in memberof fields
		for (const doc of doclets) {
			if (doc.memberof) {
				const memberof = doc.memberof;
				// Extract base module name from patterns like:
				// "module:api_test_cjs.advanced" -> "api_test_cjs"
				// "api_test_cjs.advanced" -> "api_test_cjs"
				const match = memberof.match(/^(?:module:)?([^.]+)/);
				if (match && match[1]) {
					baseModuleName = match[1];
					break;
				}
			}
		}

		if (!baseModuleName) {
			// Fallback: try to extract from longnames
			for (const doc of doclets) {
				if (doc.longname && doc.longname.includes(".")) {
					const match = doc.longname.match(/^([^.]+)/);
					if (match && match[1]) {
						baseModuleName = match[1];
						break;
					}
				}
			}
		}

		if (!baseModuleName) return null;

		// Create auto-generated root module
		return {
			kind: "module",
			longname: `module:${baseModuleName}`,
			name: baseModuleName,
			id: format.generateAnchor(`module_${baseModuleName}`),
			description: `Auto-generated module for ${baseModuleName} API.`,
			summary: `<em>This module was automatically generated because no root jsdoc.mjs file was found.</em> It provides access to the ${baseModuleName} API components.`,
			examples: [
				`// ESM usage via slothlet API\nimport slothlet from "@cldmv/slothlet";\nconst ${baseModuleName} = await slothlet({ dir: './${baseModuleName}' });`,
				`// ESM usage via slothlet API (inside async function)\nasync function example() {\n  const { default: slothlet } = await import("@cldmv/slothlet");\n  const ${baseModuleName} = await slothlet({ dir: './${baseModuleName}' });\n}`,
				`// CJS usage via slothlet API (top-level)\nlet slothlet;\n(async () => {\n  ({ slothlet } = await import("@cldmv/slothlet"));\n  const ${baseModuleName} = await slothlet({ dir: './${baseModuleName}' });\n})();`,
				`// CJS usage via slothlet API (inside async function)\nconst slothlet = require("@cldmv/slothlet");\nconst ${baseModuleName} = await slothlet({ dir: './${baseModuleName}' });`
			],
			meta: {
				filename: "auto-generated",
				lineno: 1,
				columnno: 1,
				path: "auto-generated"
			}
		};
	},

	integratedTOC(doclets, baseModuleLongname, _) {
		if (!Array.isArray(doclets)) return "";
		if (!baseModuleLongname || typeof baseModuleLongname !== "string") return "";

		// Use the central processing function to get organized data
		const processedData = functions.processDoclets(doclets, baseModuleLongname);
		const { items, constants, typedefs, globalTypedefs } = processedData;

		// Seed availableTypedefs so return-typedef sub-trees can be built in the TOC.
		// partialIntegratedTOC runs before partialIntegratedModules, so we seed here too
		// to ensure typedefs are available when buildReturnTypedefSubtree is called.
		if (!availableTypedefs.length) {
			availableTypedefs = [...new Set([...typedefs, ...(globalTypedefs || [])])];
		}

		// console.log(items);
		// process.exit(0);

		// DEBUG: Log what TOC is receiving
		// if (baseModuleName.includes("api_test")) {
		// 	console.log(`[TOC DEBUG] Processing ${baseModuleName}, got nested structure`);
		// 	console.log(Object.keys(items));
		// }

		let output = "";

		// Recursive function to build TOC from nested structure
		/**
		 * Build a nested TOC sub-tree from a typedef's flat property list.
		 * Properties like "slothlet", "slothlet.shutdown", "slothlet.api" are grouped
		 * into a hierarchy and rendered as indented TOC lines.
		 * @param {object} typedef - The typedef object from availableTypedefs
		 * @param {string} typedefAnchor - Base anchor for the typedef
		 * @param {number} startDepth - Indent depth to start at
		 * @returns {string} Formatted TOC subtree lines
		 */
		function buildReturnTypedefSubtree(typedef, typedefAnchor, startDepth) {
			if (!typedef?.properties?.length) return "";
			let treeOut = "";

			// Build a nested tree from flat dot-notated property names
			const tree = {};
			typedef.properties.forEach((prop) => {
				// Strip wrapping [] from optional names like "[slothlet.diag]"
				const rawName = prop.name.replace(/^\[|\]$/g, "");
				const parts = rawName.split(".");
				let node = tree;
				parts.forEach((part, idx) => {
					if (!node[part]) node[part] = { _prop: null, _children: {} };
					if (idx === parts.length - 1) node[part]._prop = prop;
					node = node[part]._children;
				});
			});

			/**
			 * Recursively render the tree node.
			 * @param {object} node - Current tree node
			 * @param {number} depth - Current depth
			 */
			function renderNode(node, depth) {
				const ind = "  ".repeat(depth);
				Object.keys(node).forEach((key) => {
					const entry = node[key];
					const prop = entry._prop;
					if (!prop) return;
					const isFunc = prop.type?.names?.some((n) => n === "Function" || n === "function");
					const isOptional = prop.optional;
					const displayKey = isOptional
						? `\\[${depth === startDepth ? "api" : ""}.${key}\\]`
						: `${depth === startDepth ? "api" : ""}.${key}`;
					const params = isFunc ? "()" : "";
					// For function-typed properties, the type IS the function — omit return arrow
					// to avoid misleading "⇒ <code>function</code>" (matches api_test convention)
					const retTypes = !isFunc && prop.type?.names?.length ? prop.type.names : [];
					const retStr = retTypes.length ? ` ⇒ <code>${helper.escapeHtml(retTypes.join(" | "))}</code>` : "";
					// Anchor for this individual property — dash-separated path keeps it readable.
					const rawName = prop.name.replace(/^\[|\]$/g, "");
					const propAnchor = `${typedefAnchor}_prop_${rawName.replace(/\./g, "-")}`;
					treeOut += `${ind}* [${displayKey}${params}](#${propAnchor})${retStr}\n`;
					if (Object.keys(entry._children).length > 0) {
						renderNode(entry._children, depth + 1);
					}
				});
			}

			renderNode(tree, startDepth);
			return treeOut;
		}

		function buildTOCRecursive(structure, depth = 0) {
			const indent = depth > 0 ? "  ".repeat(depth) : "";
			const prefix = depth > 0 ? "* " : "";

			Object.keys(structure).forEach((key) => {
				const item = structure[key];
				/*
				if (item.type === "namespace") {
					// Namespace - create a section header and recurse
					output += `${indent}${prefix}**${key}**\n`;
					if (item.children) {
						buildTOCRecursive(item.children, depth + 1);
					}
				} else if (item.type === "module" || item.type === "direct" || item.type === "item" || item.type === "child") {
					*/
				// Direct item, nested item, or child item - create a link
				const doclet = item.doclet;
				if (doclet) {
					if (doclet.kind === "function" || doclet.kind === "member" || doclet.kind === "namespace") {
						// const returns =
						// 	constant.doclet?.type && constant.doclet.type.names
						// 		? ` ⇒ <code>${helper.escapeHtml(constant.doclet.type.names.join(" | "))}</code>`
						// 		: "";
						output += partials.tocTreeOutput(doclet, item, indent, prefix, key);
						// const returns = doclet.returns ? ` ⇒ <code>${format.returnsForTOC(doclet.returns)}</code>` : "";
						// const anchor = item.anchor || doclet.anchor;
						// output += `${indent}${prefix}[${key}(${format.paramsForTOC(doclet.params)})](#${anchor})${returns}\n`;
					} else if (doclet.kind === "module") {
						// Module containers are already rendered as ## headings by the template.
						// Skip the TOC entry to avoid a self-referencing link, but still recurse.
					} else if (doclet.kind === "constant" || doclet.kind === "object") {
						// Module bridge constants (e.g., math, tcp, rootstring via @alias) should
						// appear in the TOC just like namespaces do.
						output += partials.tocTreeOutput(doclet, item, indent, prefix, key);
					}

					// Process children — or expand the return-typedef as a nested sub-tree
					if (item.children && Object.keys(item.children).length > 0) {
						buildTOCRecursive(item.children, depth + 1);
					} else if (doclet.returns?.length) {
						// If this item has no children but returns a typedef, expand its properties
						const returnTypeNames = doclet.returns[0]?.type?.names || [];
						for (const typeName of returnTypeNames) {
							const candidates = [typeName];
							const inner = typeName.match(/\.<([^>]+)>$/);
							if (inner) candidates.push(inner[1]);
							for (const name of candidates) {
								const typedef = Array.isArray(availableTypedefs)
									? availableTypedefs.find((td) => td.name === name && td.properties?.length > 0)
									: null;
								if (typedef) {
									const typedefAnchor = typedef.anchor || format.generateAnchor(typedef.id || typedef.name);
									output += buildReturnTypedefSubtree(typedef, typedefAnchor, depth + 1);
									break;
								}
							}
						}
					}
				}
				// }
			});
		}

		// Build the TOC from the nested structure, starting at depth 0
		buildTOCRecursive(items);

		if (output !== "") {
			output = `**Structure**\n\n` + output;
			// For the main slothlet module, append a link to the runtime sub-module
			if (baseModuleLongname === "module:@cldmv/slothlet") {
				output += `\n[@cldmv/slothlet/runtime](#at_cldmv_slash_slothlet_slash_runtime)\n`;
			}
		}
		// Add constants section if any
		if (constants && constants.length > 0) {
			output += `\n\n`;
			output += `**Exported Constants**\n\n`;
			constants.forEach((constant) => {
				// const anchor = constant.anchor || format.generateAnchor(constant.doclet?.id);
				const anchor = constant.anchor || constant.doclet?.anchor;
				const simpleName = constant.doclet?.simpleName || constant.doclet?.name;
				// Format type info similar to functions
				const typeInfo =
					constant.doclet?.type && constant.doclet.type.names
						? ` ⇒ <code>${helper.escapeHtml(constant.doclet.type.names.join(" | "))}</code>`
						: "";
				output += `  * [${simpleName}](#${anchor})${typeInfo}\n`;
			});
		}

		return output;
	},

	integratedModules(doclets, baseModuleLongname, _) {
		if (!Array.isArray(doclets)) return "";
		if (!baseModuleLongname || typeof baseModuleLongname !== "string") return "";

		// Use the central processing function to get organized data
		const processedData = functions.processDoclets(doclets, baseModuleLongname);
		const { items, typedefs, globalTypedefs, baseModuleName } = processedData;

		let output = "";

		availableTypedefs = [...new Set([...typedefs, ...globalTypedefs])];

		// console.log(availableTypedefs);
		// process.exit(0);

		// Recursive function to generate documentation for nested structure
		function generateModuleSection(structure, currentPath = "") {
			let sectionOutput = "";

			Object.keys(structure).forEach((key) => {
				const item = structure[key];
				const fullPath = currentPath ? `${currentPath}.${key}` : key;

				// if (item.type === "module" || item.type === "direct" || item.type === "item") {
				const doclet = item.doclet;
				if (!doclet) return;

				// Module-kind items are section containers already rendered at the ## level by the
				// template. Skip the duplicate ### header/description but still recurse into children.
				if (doclet.kind === "module") {
					if (item.children && Object.keys(item.children).length > 0) {
						sectionOutput += generateModuleSection(item.children, fullPath);
					}
					return;
				}

				// Use pre-calculated anchor
				sectionOutput += `\n* * *\n\n`;

				let anchor = item.anchor || doclet.anchor;
				if (doclet.level === 0) {
					anchor = item.anchorSmart || doclet.anchorSmart;
				}

				sectionOutput += `<a id="${anchor}"></a>\n\n`;

				const outputName = format.preferredFunctionName(item) || key;

				// Generate proper function signature matching baseline format
				if (doclet.kind === "function") {
					const params = format.paramsForTOC(doclet.params) || "";
					const returns = doclet.returns ? ` ⇒ ${format.returnsForTOC(doclet.returns)}` : "";
					sectionOutput += `### ${outputName}(${params})${returns}\n`;
				} else {
					sectionOutput += `### ${outputName}\n`;
				}

				// Add description
				sectionOutput += partials.description(doclet);

				// Add Kind line matching baseline format using dmd standard patterns
				sectionOutput += partials.kind(item, baseModuleName, baseModuleLongname);

				// Use proper helper functions for structured content
				sectionOutput = partials.params(doclet, sectionOutput, doclet.longname, availableTypedefs);
				sectionOutput = partials.returns(doclet, sectionOutput);
				sectionOutput = partials.throws(doclet, sectionOutput);
				sectionOutput = partials.examples(doclet, sectionOutput);
				// sectionOutput = partials.typedefs(doclet, sectionOutput);

				// Process children if any
				if (item.children && Object.keys(item.children).length > 0) {
					sectionOutput += generateModuleSection(item.children, fullPath);
					// sectionOutput += generateChildrenSection(item.children, fullPath);
				}
				/* } else if (item.type === "namespace") {
					// For namespaces, just process children recursively
					if (item.children && Object.keys(item.children).length > 0) {
						sectionOutput += generateModuleSection(item.children, fullPath);
					}
				} */
			});

			return sectionOutput;
		}

		// Generate the main module documentation
		output += generateModuleSection(items);

		// For the main slothlet module, inline the typedef definitions here so they
		// appear within ## @cldmv/slothlet — before ## @cldmv/slothlet/runtime.
		if (baseModuleLongname === "module:@cldmv/slothlet" && availableTypedefs.length > 0) {
			slothletTypedefsInlined = false; // allow the call below to produce output
			const typedefBlock = partials.globalTypedefDefinitions();
			// Strip the "## Type Definitions" H2 header so content stays inside this module
			output += typedefBlock.replace(/[\r\n]*## Type Definitions\n+/, "\n\n");
			slothletTypedefsInlined = true;
		}

		return output;
	},

	/**
	 * Check if typedefs should be shared between child and parent modules
	 * @param {string} childModule - Child module name
	 * @param {string} parentModule - Parent module name
	 * @returns {boolean} True if typedefs should be shared
	 */
	shouldShareTypedefs: (childModule, parentModule) => {
		return functions.isChildModule(childModule, parentModule);
	}
};
/*
	Custom Helpers (from helpers.cjs):
	hasRootModule - Checks if a root module exists in the doclets
		partials.missingRootModule - buildMissingRootModule - Creates a missing root module from memberof patterns
	generateAnchor - Generates HTML anchors for documentation sections
		gets.moduleFunction - getModuleFunction - Retrieves module function data
		partials.integratedTOC - buildIntegratedTOC - Builds integrated table of contents with real + auto-generated modules
		partials.integratedModules - buildIntegratedModules - Generates documentation sections for all module types
		gets.originalModuleTitle - getOriginalModuleTitle - Gets the original module title
		partials.typedefDefinitions - buildTypedefDefinitions - Builds typedef definition sections
*/
/**
 * Converts a string to camelCase, preserving uppercase sequences.
 * Digits are allowed except at the start.
 * @param {string} str
 * @param {boolean} upperFirst - If true, uppercase the first letter.
 * @returns {string}
 */
function camelCase(str, upperFirst = false) {
	str = str.replace(/^[0-9]+/, "");
	// Split on non-alphanumeric or before uppercase letters (but preserve uppercase runs)
	const parts = str
		.replace(/[^a-zA-Z0-9]+/g, " ") // split on non-alphanumeric
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2") // split before uppercase after lowercase/digit
		.split(" ")
		.filter(Boolean);
	let result = parts
		.map((word, i) => {
			if (i === 0 && !upperFirst) return word.toLowerCase();
			return word[0].toUpperCase() + word.slice(1);
		})
		.join("");
	if (upperFirst && result) {
		result = result[0].toUpperCase() + result.slice(1);
	}
	return result;
}

module.exports["functions"] = functions;

for (const key of Object.keys(helper)) {
	module.exports[key] = helper[key];
}

for (const key of Object.keys(partials)) {
	const newKey = "partial" + camelCase(key, true);
	// console.log(newKey);
	module.exports[newKey] = partials[key];
}

for (const key of Object.keys(gets)) {
	const newKey = "get" + camelCase(key, true);
	// console.log(newKey);
	module.exports[newKey] = gets[key];
}

// module.exports.helper = helper;
module.exports.helper = helper;
