#!/usr/bin/env node

/**
 * Test script to debug doclet processing using the actual helper functions
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

// Add --private flag to simulate jsdoc2md behavior
// process.argv.push("--private"); // Commented out to test without private functions

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

async function main() {
	// Define paths first
	const apiTestJsonPath = path.join(__dirname, "debug_api_test_order.json");
	const slothletJsonPath = path.join(__dirname, "debug_slothlet_order.json");

	if (!fs.existsSync(apiTestJsonPath)) {
		console.error(`JSON file not found: ${apiTestJsonPath}`);
		console.log("Please generate it first with:");
		console.log('jsdoc2md -c ".configs/jsdoc.config.json" "api_tests/api_test/**/*.mjs" --json > debug_api_test_order.json');
		process.exit(1);
	}

	if (!fs.existsSync(slothletJsonPath)) {
		console.error(`JSON file not found: ${slothletJsonPath}`);
		console.log("Please generate it first with:");
		console.log(
			'jsdoc2md -c ".configs/jsdoc.config.json" "src/{slothlet.mjs,lib/{modes,helpers,runtime}/**/*.mjs}" --json > debug_slothlet_order.json'
		);
		process.exit(1);
	}
	try {
		console.log("Loading doclets from both JSON files...");
		const apiTestDoclets = JSON.parse(fs.readFileSync(apiTestJsonPath, "utf8"));
		const slothletDoclets = JSON.parse(fs.readFileSync(slothletJsonPath, "utf8"));
		console.log(`Loaded ${apiTestDoclets.length} api_test doclets`);
		console.log(`Loaded ${slothletDoclets.length} slothlet doclets`);

		// Load the actual helpers module
		console.log("Loading helpers...");
		const helpers = require("./docs/helpers.cjs");

		// Test both datasets
		const datasets = [
			{
				name: "slothlet_main",
				doclets: slothletDoclets,
				baseModule: "module:@cldmv/slothlet"
			},
			{
				name: "api_test",
				doclets: apiTestDoclets,
				baseModule: "module:api_test"
			},
			{
				name: "slothlet_runtime",
				doclets: slothletDoclets,
				baseModule: "module:@cldmv/slothlet/runtime"
			}
		];
		for (const dataset of datasets) {
			console.log(`\n${"=".repeat(60)}`);
			console.log(`=== Testing ${dataset.name.toUpperCase()} dataset ===`);
			console.log(`${"=".repeat(60)}`);

			// Test the central processing function
			console.log(`\n--- Testing processDoclets for ${dataset.name} ---`);
			console.log(`Base module: ${dataset.baseModule}`);

			console.log("Calling processDoclets...");
			const processedData = helpers.functions.processDoclets(dataset.doclets, dataset.baseModule);
			// helpers.partialIntegratedModules(dataset.doclets, dataset.baseModule);

			console.log("\n--- Constants Details ---");
			console.log(`Found ${processedData.constants.length} constants:`);
			processedData.constants.forEach((constant, index) => {
				console.log(`${index + 1}. Type: ${constant.type}`);
				console.log(`   Doclet kind: ${constant.doclet?.kind}`);
				console.log(`   Doclet name: ${constant.doclet?.name}`);
				console.log(`   Doclet simpleName: ${constant.doclet?.simpleName}`);
				console.log(`   Doclet id: ${constant.doclet?.id}`);
				console.log(`   Doclet longname: ${constant.doclet?.longname}`);
				console.log(`   Doclet anchor: ${constant.doclet?.anchor}`);
				console.log("---");
			});

			console.dir(processedData.items, { depth: 3 });
			// console.dir(processedData.items, { depth: 5 });
			// console.dir(processedData, { depth: 2 });
			// console.dir(processedData.typedefs, { depth: 6 });
			// console.dir(processedData.constants, { depth: 6 });
			process.exit(0);

			console.log("\n--- Processed Data Summary ---");
			console.log(`Items: ${Object.keys(processedData.items).length} top-level items`);
			console.log(`Constants: ${processedData.constants.length}`);
			console.log(`Typedefs: ${processedData.typedefs.length}`);
			console.log(`Global typedefs: ${processedData.globalTypedefs.length}`);
			console.log(`Base module name: ${processedData.baseModuleName}`);

			// Show breakdown by item type
			const typeBreakdown = {};
			function countTypes(structure) {
				Object.values(structure).forEach((item) => {
					typeBreakdown[item.type] = (typeBreakdown[item.type] || 0) + 1;
					if (item.children) {
						countTypes(item.children);
					}
				});
			}
			countTypes(processedData.items);

			console.log(
				`Type breakdown: ${Object.entries(typeBreakdown)
					.map(([type, count]) => `${type}(${count})`)
					.join(", ")}`
			);

			console.log("\n--- Top-level Items (in order) ---");

			function displayItemsRecursive(structure, level = 0) {
				const indent = "  ".repeat(level);
				let itemIndex = 1;

				Object.entries(structure).forEach(([key, item]) => {
					console.log(`${indent}${itemIndex}. ${key} (${item.type}) - JSDoc order: ${item.doclet?.order || "N/A"}`);

					// Show returns and throws for functions
					if (item.doclet && (item.type === "direct" || item.type === "item") && item.doclet.kind === "function") {
						if (item.doclet.returns && item.doclet.returns.length > 0) {
							console.log(`${indent}   Returns: ${helpers.formatReturnsForTOC(item.doclet.returns)}`);
						}
						if (item.doclet.exceptions && item.doclet.exceptions.length > 0) {
							const throwsInfo = item.doclet.exceptions
								.map((exc) => `${exc.type?.names?.join("|") || "Error"}: ${exc.description || ""}`)
								.join(", ");
							console.log(`${indent}   Throws: ${throwsInfo}`);
						}
					}

					// Show typedef details
					if (item.doclet && item.doclet.kind === "typedef") {
						if (item.doclet.type && item.doclet.type.names) {
							console.log(`${indent}   Type: ${item.doclet.type.names.join(" | ")}`);
						}
						if (item.doclet.properties && item.doclet.properties.length > 0) {
							console.log(`${indent}   Properties: ${item.doclet.properties.length}`);
						}
					}

					if (item.children && Object.keys(item.children).length > 0) {
						console.log(`${indent}   Children: ${Object.keys(item.children).length}`);
						const childEntries = Object.entries(item.children).slice(0, 3);
						childEntries.forEach(([childKey, child]) => {
							console.log(`${indent}     - ${childKey} (${child.type}) - order: ${child.doclet?.order || "N/A"}`);
							// Show returns/throws for child functions too
							if (child.doclet && child.doclet.kind === "function") {
								if (child.doclet.returns && child.doclet.returns.length > 0) {
									console.log(`${indent}       Returns: ${helpers.formatReturnsForTOC(child.doclet.returns)}`);
								}
								if (child.doclet.exceptions && child.doclet.exceptions.length > 0) {
									const throwsInfo = child.doclet.exceptions
										.map((exc) => `${exc.type?.names?.join("|") || "Error"}: ${exc.description || ""}`)
										.join(", ");
									console.log(`${indent}       Throws: ${throwsInfo}`);
								}
							}
						});
						if (Object.keys(item.children).length > 3) {
							console.log(`${indent}     ... and ${Object.keys(item.children).length - 3} more`);
						}
					}
					itemIndex++;
				});
			}

			displayItemsRecursive(processedData.items);

			console.log(`\n--- Complete TOC for ${dataset.name} ---`);
			const tocOutput = helpers.partialIntegratedTOC(dataset.doclets, dataset.baseModule);

			// Show the complete TOC as it would appear in the markdown file
			const moduleAnchor = helpers.generateAnchor(`module_${dataset.baseModule.replace(/^module:/, "")}`);
			console.log(`* [${dataset.baseModule.replace(/^module:/, "")}](#${moduleAnchor})`);
			console.log(tocOutput);

			console.log(`\n--- TOC Statistics for ${dataset.name} ---`);
			const tocLines = tocOutput.split("\n").filter((line) => line.trim());
			console.log(`Total TOC lines: ${tocLines.length}`);
			console.log(`TOC output complete - showing all ${tocLines.length} lines above`);

			// Save processed data for inspection
			const outputPath = path.join(__dirname, `debug_processed_${dataset.name}.json`);
			fs.writeFileSync(outputPath, JSON.stringify(processedData, null, 2));
			console.log(`\nProcessed data saved to: ${outputPath}`);
		}
	} catch (error) {
		console.error("Error:", error);
		console.error(error.stack);
		process.exit(1);
	}
}

main();
