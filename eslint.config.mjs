import js from "@eslint/js";
import globals from "globals";
import json from "@eslint/json";
import yml from "eslint-plugin-yml";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import html from "@html-eslint/eslint-plugin";
import { defineConfig } from "eslint/config";

export default defineConfig([
	{
		files: ["**/*.{js,mjs,cjs}"],
		plugins: { js },
		extends: ["js/recommended"],
		rules: {
			"no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_$",
					caughtErrorsIgnorePattern: "^_$",
					destructuredArrayIgnorePattern: "^_$",
					varsIgnorePattern: "^_$"
				}
			]
		}
	},
	{ files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
	{ files: ["**/*.{js,mjs,cjs}"], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
	{
		files: ["**/test/**/*test.js"],
		languageOptions: {
			globals: {
				beforeAll: true,
				afterAll: true,
				describe: true,
				it: true,
				expect: true,
				test: true
			}
		}
	},
	{ files: ["**/*.json"], plugins: { json }, language: "json/json", extends: ["json/recommended"] },
	{ files: ["**/*.jsonc"], plugins: { json }, language: "json/jsonc", extends: ["json/recommended"] },
	{ files: ["**/*.json5"], plugins: { json }, language: "json/json5", extends: ["json/recommended"] },
	{ files: ["**/*.{yml,yaml}"], plugins: { yml }, language: "yaml", extends: ["plugin:yml/standard"] },
	{ files: ["**/*.md"], plugins: { markdown }, language: "markdown/gfm", extends: ["markdown/recommended"] },
	{ files: ["**/*.css"], plugins: { css }, language: "css/css", extends: ["css/recommended"] },
	{
		files: ["**/*.html"],
		languageOptions: { parser: "@html-eslint/parser" },
		plugins: { html },
		extends: ["plugin:@html-eslint/recommended"]
	}
]);
