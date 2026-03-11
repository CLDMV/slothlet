<a id="tools_slash_fix-headers"></a>

## tools/fix-headers
> <p><strong style="font-size: 1.1em;"><p>Preserves the original script UX for Slothlet (<code>--dry-run</code>, <code>--verbose</code>, <code>--diff</code>,
> <code>--help</code>), while offloading all header logic to the shared @cldmv/fix-headers package.</p></strong></p>
> 


**Structure**

[tools/fix-headers](#tools_slash_fix-headers)
  * [.showHelp()](#tools_slash_fix-headers~showHelp) ⇒ <code><code>void</code></code>
  * [.parseArguments(args)](#tools_slash_fix-headers~parseArguments) ⇒ <code><code>Object</code></code>
  * [.buildOptions(parsed)](#tools_slash_fix-headers~buildOptions) ⇒ <code><code>FixHeadersOptions</code></code>
  * [.printSummary(result, opts)](#tools_slash_fix-headers~printSummary) ⇒ <code><code>void</code></code>
  * [.main()](#tools_slash_fix-headers~main) ⇒ <code><code>Promise.&lt;void&gt;</code></code>


**Type Definitions**

  * [undefined](#)
  * [undefined](#)
  * [FixHeadersOptions](#typedef_module_tools_slash_fix-headers~FixHeadersOptions) : <code>Object</code>
  * [FixHeadersResult](#typedef_module_tools_slash_fix-headers~FixHeadersResult) : <code>Object</code>


**Example**
```js
node tools/fix-headers.mjs --dry-run
```
**Example**
```js
node tools/fix-headers.mjs --verbose
```





* * *

<a id="tools_slash_fix-headers"></a>

### tools/fix-headers
> <p><strong style="font-size: 1.1em;"><p>Preserves the original script UX for Slothlet (<code>--dry-run</code>, <code>--verbose</code>, <code>--diff</code>,
> <code>--help</code>), while offloading all header logic to the shared @cldmv/fix-headers package.</p></strong></p>
> 
**Example**
```js
node tools/fix-headers.mjs --dry-run
```
**Example**
```js
node tools/fix-headers.mjs --verbose
```



* * *

<a id="typedef_module_tools_slash_fix-headers~FixHeadersOptions"></a>

### tools/fix-headers.FixHeadersOptions
> <p><strong style="font-size: 1.1em;"><p>Options accepted by the <code>fixHeaders</code> function from @cldmv/fix-headers.</p></strong></p>
> 
**Kind**: inner typedef of [<code>tools/fix-headers</code>](#tools_slash_fix-headers)


* * *

<a id="typedef_module_tools_slash_fix-headers~FixHeadersResult"></a>

### tools/fix-headers.FixHeadersResult
> <p><strong style="font-size: 1.1em;"><p>Result returned by the <code>fixHeaders</code> function from @cldmv/fix-headers.</p></strong></p>
> 
**Kind**: inner typedef of [<code>tools/fix-headers</code>](#tools_slash_fix-headers)


* * *

<a id="tools_slash_fix-headers~showHelp"></a>

### tools/fix-headers.showHelp() ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Print CLI help.</p></strong></p>
> 
**Kind**: inner method of [<code>tools/fix-headers</code>](#tools_slash_fix-headers)

**Returns**:

- <code>void</code> <p></p>


**Example**
```js
showHelp();
```



* * *

<a id="tools_slash_fix-headers~parseArguments"></a>

### tools/fix-headers.parseArguments(args) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Parse CLI arguments into runner options.</p></strong></p>
> 
**Kind**: inner method of [<code>tools/fix-headers</code>](#tools_slash_fix-headers)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| args | <code>Array.&lt;string&gt;</code> |  | <p>Raw process arguments excluding node and script path.</p> |


**Returns**:

- <code>Object</code> <p>Parsed options.</p>


**Example**
```js
const opts = parseArguments(["--dry-run", "--verbose"]);
```



* * *

<a id="tools_slash_fix-headers~buildOptions"></a>

### tools/fix-headers.buildOptions(parsed) ⇒ <code>FixHeadersOptions</code>
> <p><strong style="font-size: 1.1em;"><p>Build fixHeaders options from parsed CLI args and project header config.</p></strong></p>
> 
**Kind**: inner method of [<code>tools/fix-headers</code>](#tools_slash_fix-headers)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| parsed | <code>Object</code> |  | <p>Parsed CLI arguments.</p> |


**Returns**:

- <code>[FixHeadersOptions](#typedef_module_tools_slash_fix-headers~FixHeadersOptions)</code> <p>Options for @cldmv/fix-headers.</p>


**Example**
```js
const options = buildOptions({ dryRun: true });
```



* * *

<a id="tools_slash_fix-headers~printSummary"></a>

### tools/fix-headers.printSummary(result, opts) ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Print the run result summary to stdout.</p></strong></p>
> 
**Kind**: inner method of [<code>tools/fix-headers</code>](#tools_slash_fix-headers)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| result | <code>[FixHeadersResult](#typedef_module_tools_slash_fix-headers~FixHeadersResult)</code> |  | <p>Result from @cldmv/fix-headers.</p> |
| opts | <code>Object</code> |  | <p>Display options.</p> |


**Returns**:

- <code>void</code> <p></p>


**Example**
```js
printSummary(result, { verbose: true, diff: false, dryRun: false });
```



* * *

<a id="tools_slash_fix-headers~main"></a>

### tools/fix-headers.main() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Execute the compatibility wrapper.</p></strong></p>
> 
**Kind**: inner method of [<code>tools/fix-headers</code>](#tools_slash_fix-headers)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p>Resolves when all header processing is complete.</p>


**Example**
```js
await main();
```




<a id="at_cldmv_slash_slothlet_slash_tools_slash_build-exports"></a>

## @cldmv/slothlet/tools/build-exports
> <p><strong style="font-size: 1.1em;"><p>Automatically generates <code>index.mjs</code> and TypeScript declaration files by scanning the main
> slothlet source file for exports. This ensures that entry points stay in sync with the
> actual exports from the core module without manual maintenance.</p>
> <p>Key features:</p>
> <ul>
> <li>Parses both named and default exports from source files</li>
> <li>Generates ESM entry point with auto-detection (dist/ vs src/)</li>
> <li>Creates TypeScript declaration files with proper type re-exports</li>
> <li>Preserves query parameters for multi-instance coordination</li>
> <li>Handles destructured export statements</li>
> </ul>
> <p>Technical implementation:</p>
> <ul>
> <li>Uses regex parsing to extract export statements from JavaScript source</li>
> <li>Generates template-based index files with dynamic export lists</li>
> <li>Creates separate TypeScript declarations for proper IDE support</li>
> <li>Implements fallback logic for development vs production builds</li>
> </ul></strong></p>
> 


**Structure**

[@cldmv/slothlet/tools/build-exports](#at_cldmv_slash_slothlet_slash_tools_slash_build-exports)


**Example**
```js
// Run the build script
npm run build:exports
```
**Example**
```js
// Use programmatically
import { buildExports } from "./tools/build-exports.mjs";
await buildExports();
```





* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_build-exports"></a>

### @cldmv/slothlet/tools/build-exports
> <p><strong style="font-size: 1.1em;"><p>Automatically generates <code>index.mjs</code> and TypeScript declaration files by scanning the main
> slothlet source file for exports. This ensures that entry points stay in sync with the
> actual exports from the core module without manual maintenance.</p>
> <p>Key features:</p>
> <ul>
> <li>Parses both named and default exports from source files</li>
> <li>Generates ESM entry point with auto-detection (dist/ vs src/)</li>
> <li>Creates TypeScript declaration files with proper type re-exports</li>
> <li>Preserves query parameters for multi-instance coordination</li>
> <li>Handles destructured export statements</li>
> </ul>
> <p>Technical implementation:</p>
> <ul>
> <li>Uses regex parsing to extract export statements from JavaScript source</li>
> <li>Generates template-based index files with dynamic export lists</li>
> <li>Creates separate TypeScript declarations for proper IDE support</li>
> <li>Implements fallback logic for development vs production builds</li>
> </ul></strong></p>
> 
**Example**
```js
// Run the build script
npm run build:exports
```
**Example**
```js
// Use programmatically
import { buildExports } from "./tools/build-exports.mjs";
await buildExports();
```




<a id="at_cldmv_slash_slothlet_slash_tools_slash_precommit-validation"></a>

## @cldmv/slothlet/tools/precommit-validation
> <p><strong style="font-size: 1.1em;"><p>Pre-commit validation tool that runs the mandatory validation sequence and only allows commits if all tests pass.</p></strong></p>
> 


**Structure**

[@cldmv/slothlet/tools/precommit-validation](#at_cldmv_slash_slothlet_slash_tools_slash_precommit-validation)





* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_precommit-validation"></a>

### @cldmv/slothlet/tools/precommit-validation
> <p><strong style="font-size: 1.1em;"><p>Pre-commit validation tool that runs the mandatory validation sequence and only allows commits if all tests pass.</p></strong></p>
> 


<a id="at_cldmv_slash_slothlet_slash_tools_slash_prepend-license"></a>

## @cldmv/slothlet/tools/prepend-license
> <p><strong style="font-size: 1.1em;"><p>Automatically prepends Apache License Version 2.0 headers to all applicable source files in a target directory.
> Intelligently extracts owner information from package.json and handles various file types with appropriate
> comment syntax.</p>
> <p>Key features:</p>
> <ul>
> <li>Auto-detects owner from package.json author/contributors fields</li>
> <li>Supports multiple file types with appropriate comment syntax (.js, .css, .html, .json, etc.)</li>
> <li>Preserves shebang lines when present</li>
> <li>Skips files that already have Apache license headers</li>
> <li>Intelligent comment removal that doesn't break string literals containing &quot;//&quot;</li>
> <li>Configurable via command line arguments (--owner, --year)</li>
> </ul>
> <p>Technical implementation:</p>
> <ul>
> <li>Uses regex-based parsing to identify existing license headers</li>
> <li>Implements safe comment removal that preserves string content</li>
> <li>Recursively walks directory trees while skipping node_modules and .git</li>
> <li>Reads license template from .configs/license-header.txt</li>
> <li>Supports various comment syntaxes based on file extensions</li>
> </ul></strong></p>
> 


**Structure**

[@cldmv/slothlet/tools/prepend-license](#at_cldmv_slash_slothlet_slash_tools_slash_prepend-license)


**Example**
```js
// Apply to default dist/ directory with auto-detected owner
node tools/prepend-license.mjs
```
**Example**
```js
// Apply to specific directory with custom owner and year
node tools/prepend-license.mjs --owner "ACME Corp" --year "2024" ./build
```
**Example**
```js
// Apply to current directory
node tools/prepend-license.mjs .
```





* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_prepend-license"></a>

### @cldmv/slothlet/tools/prepend-license
> <p><strong style="font-size: 1.1em;"><p>Automatically prepends Apache License Version 2.0 headers to all applicable source files in a target directory.
> Intelligently extracts owner information from package.json and handles various file types with appropriate
> comment syntax.</p>
> <p>Key features:</p>
> <ul>
> <li>Auto-detects owner from package.json author/contributors fields</li>
> <li>Supports multiple file types with appropriate comment syntax (.js, .css, .html, .json, etc.)</li>
> <li>Preserves shebang lines when present</li>
> <li>Skips files that already have Apache license headers</li>
> <li>Intelligent comment removal that doesn't break string literals containing &quot;//&quot;</li>
> <li>Configurable via command line arguments (--owner, --year)</li>
> </ul>
> <p>Technical implementation:</p>
> <ul>
> <li>Uses regex-based parsing to identify existing license headers</li>
> <li>Implements safe comment removal that preserves string content</li>
> <li>Recursively walks directory trees while skipping node_modules and .git</li>
> <li>Reads license template from .configs/license-header.txt</li>
> <li>Supports various comment syntaxes based on file extensions</li>
> </ul></strong></p>
> 
**Example**
```js
// Apply to default dist/ directory with auto-detected owner
node tools/prepend-license.mjs
```
**Example**
```js
// Apply to specific directory with custom owner and year
node tools/prepend-license.mjs --owner "ACME Corp" --year "2024" ./build
```
**Example**
```js
// Apply to current directory
node tools/prepend-license.mjs .
```







* * *

## Type Definitions

<a id="typedef_ParsedI18nArgs"></a>

### ParsedI18nArgs : <code>Object</code>
<p>Parsed CLI arguments for check-i18n-languages.</p>

**Kind**: typedef  
**Scope**: global


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [languagesDir] | <code>string</code> |  | Optional custom path to the languages directory (overrides default). |


* * *


