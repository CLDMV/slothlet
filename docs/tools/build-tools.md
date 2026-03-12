<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors"></a>

## @cldmv/slothlet/tools/analyze-errors
> <p><strong style="font-size: 1.1em;"><p>Checks:</p>
> <ul>
> <li>Proper error construction (originalError passed when needed)</li>
> <li>Hint availability for each error code</li>
> <li>Stub vs real error classification</li>
> <li>Translation availability for all error codes</li>
> <li>Unused translations</li>
> <li>Placeholder consistency between usage and translations</li>
> </ul></strong></p>
> 


**Structure**

  * [.shouldIgnorePath()](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_shouldIgnorePath)
  * [.findMjsFiles()](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_findMjsFiles)
  * [.findMjsFilesInFolders()](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_findMjsFilesInFolders)
  * [.parseConsoleWarns()](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_parseConsoleWarns)
  * [.parseConsoleLogs(content, filePath)](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_parseConsoleLogs) ⇒ <code>Array</code>
  * [.parseConsoleErrors(content, filePath)](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_parseConsoleErrors) ⇒ <code>Array</code>
  * [.parseBareNewErrors(content, filePath)](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_parseBareNewErrors) ⇒ <code>Array</code>
  * [.hasProperFileHeader(content, filePath)](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_hasProperFileHeader) ⇒ <code>boolean</code>
  * [.parseErrorThrows()](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_parseErrorThrows)
  * [.analyzeError()](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_analyzeError)
  * [.checkTranslationExists()](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_checkTranslationExists)
  * [.checkHintExists()](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_checkHintExists)
  * [.parseHardcodedReasons(content, filePath)](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_parseHardcodedReasons) ⇒ <code>Array</code>
  * [.parseHardcodedDebugMessagesMultiline(content, filePath)](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_parseHardcodedDebugMessagesMultiline) ⇒ <code>Array</code>





* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_shouldIgnorePath"></a>

### @cldmv/slothlet/tools/analyze-errors.shouldIgnorePath()
> <p><strong style="font-size: 1.1em;"><p>Check if a path should be ignored</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/analyze-errors</code>](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors)


* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_findMjsFiles"></a>

### @cldmv/slothlet/tools/analyze-errors.findMjsFiles()
> <p><strong style="font-size: 1.1em;"><p>Recursively find all .mjs files</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/analyze-errors</code>](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors)


* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_findMjsFilesInFolders"></a>

### @cldmv/slothlet/tools/analyze-errors.findMjsFilesInFolders()
> <p><strong style="font-size: 1.1em;"><p>Find all .mjs files in specified folders with optional recursion</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/analyze-errors</code>](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors)


* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_parseConsoleWarns"></a>

### @cldmv/slothlet/tools/analyze-errors.parseConsoleWarns()
> <p><strong style="font-size: 1.1em;"><p>Parse console.warn calls from file content</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/analyze-errors</code>](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors)


* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_parseConsoleLogs"></a>

### @cldmv/slothlet/tools/analyze-errors.parseConsoleLogs(content, filePath) ⇒ <code>Array</code>
> <p><strong style="font-size: 1.1em;"><p>Parse console.log statements and check if they're inside SlothletDebug class</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/analyze-errors</code>](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| content | <code>string</code> |  | <p>File content</p> |
| filePath | <code>string</code> |  | <p>File path</p> |


**Returns**:

- <code>Array</code> <p>Array of improper console.log statements (outside SlothletDebug)</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_parseConsoleErrors"></a>

### @cldmv/slothlet/tools/analyze-errors.parseConsoleErrors(content, filePath) ⇒ <code>Array</code>
> <p><strong style="font-size: 1.1em;"><p>Parse console.error calls from file content.
> These are always violations – errors must use SlothletError / SlothletWarning
> and must never be printed directly.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/analyze-errors</code>](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| content | <code>string</code> |  | <p>File content</p> |
| filePath | <code>string</code> |  | <p>File path</p> |


**Returns**:

- <code>Array</code> <p>Array of improper console.error statements</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_parseBareNewErrors"></a>

### @cldmv/slothlet/tools/analyze-errors.parseBareNewErrors(content, filePath) ⇒ <code>Array</code>
> <p><strong style="font-size: 1.1em;"><p>Parse bare <code>new Error(...)</code> calls that should use <code>new this.SlothletError(...)</code>.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/analyze-errors</code>](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| content | <code>string</code> |  | <p>File content</p> |
| filePath | <code>string</code> |  | <p>File path</p> |


**Returns**:

- <code>Array</code> <p>Array of bare new Error usages</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_hasProperFileHeader"></a>

### @cldmv/slothlet/tools/analyze-errors.hasProperFileHeader(content, filePath) ⇒ <code>boolean</code>
> <p><strong style="font-size: 1.1em;"><p>Check if file has proper file header</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/analyze-errors</code>](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| content | <code>string</code> |  | <p>File content</p> |
| filePath | <code>string</code> |  | <p>File path</p> |


**Returns**:

- <code>boolean</code> <p>True if file has proper header</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_parseErrorThrows"></a>

### @cldmv/slothlet/tools/analyze-errors.parseErrorThrows()
> <p><strong style="font-size: 1.1em;"><p>Parse SlothletError and SlothletWarning throws from file content</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/analyze-errors</code>](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors)


* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_analyzeError"></a>

### @cldmv/slothlet/tools/analyze-errors.analyzeError()
> <p><strong style="font-size: 1.1em;"><p>Analyze error and determine status</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/analyze-errors</code>](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors)


* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_checkTranslationExists"></a>

### @cldmv/slothlet/tools/analyze-errors.checkTranslationExists()
> <p><strong style="font-size: 1.1em;"><p>Check if translation exists for error code</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/analyze-errors</code>](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors)


* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_checkHintExists"></a>

### @cldmv/slothlet/tools/analyze-errors.checkHintExists()
> <p><strong style="font-size: 1.1em;"><p>Check if hint exists for error code</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/analyze-errors</code>](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors)


* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_parseHardcodedReasons"></a>

### @cldmv/slothlet/tools/analyze-errors.parseHardcodedReasons(content, filePath) ⇒ <code>Array</code>
> <p><strong style="font-size: 1.1em;"><p>Parse hardcoded reason: strings that should use i18n</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/analyze-errors</code>](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| content | <code>string</code> |  | <p>File content</p> |
| filePath | <code>string</code> |  | <p>File path</p> |


**Returns**:

- <code>Array</code> <p>Array of hardcoded reason strings</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors_parseHardcodedDebugMessagesMultiline"></a>

### @cldmv/slothlet/tools/analyze-errors.parseHardcodedDebugMessagesMultiline(content, filePath) ⇒ <code>Array</code>
> <p><strong style="font-size: 1.1em;"><p>Parse hardcoded message: strings inside debug() calls that should use i18n DEBUG_MODE_ keys.
> Handles multi-line debug() call patterns where <code>message:</code> appears on its own line.
> The correct pattern is: { key: &quot;DEBUG_MODE_KEY&quot;, ...params } - no await t() needed.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/analyze-errors</code>](#at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| content | <code>string</code> |  | <p>File content</p> |
| filePath | <code>string</code> |  | <p>File path</p> |


**Returns**:

- <code>Array</code> <p>Array of hardcoded debug message strings</p>




<a id="at_cldmv_slash_slothlet_slash_tools_slash_fix-headers"></a>

## @cldmv/slothlet/tools/fix-headers
> <p><strong style="font-size: 1.1em;"><p>Preserves the original script UX for Slothlet (<code>--dry-run</code>, <code>--verbose</code>, <code>--diff</code>,
> <code>--help</code>), while offloading all header logic to the shared @cldmv/fix-headers package.</p></strong></p>
> 


**Structure**

  * [.showHelp()](#at_cldmv_slash_slothlet_slash_tools_slash_fix-headers_showHelp) ⇒ <code>void</code>
  * [.parseArguments(args)](#at_cldmv_slash_slothlet_slash_tools_slash_fix-headers_parseArguments) ⇒ <code>Object</code>
  * [.buildOptions(parsed)](#at_cldmv_slash_slothlet_slash_tools_slash_fix-headers_buildOptions) ⇒ <code>FixHeadersOptions</code>
    * \[.cwd\] ⇒ <code>string</code>
    * \[.input\] ⇒ <code>string</code>
    * \[.dryRun\] ⇒ <code>boolean</code>
    * \[.projectName\] ⇒ <code>string</code>
    * \[.companyName\] ⇒ <code>string</code>
    * \[.copyrightStartYear\] ⇒ <code>number</code>
    * \[.includeFolders\] ⇒ <code>Array.&lt;string&gt;</code>
    * \[.excludeFolders\] ⇒ <code>Array.&lt;string&gt;</code>
    * \[.includeExtensions\] ⇒ <code>Array.&lt;string&gt;</code>
  * [.printSummary(result, opts)](#at_cldmv_slash_slothlet_slash_tools_slash_fix-headers_printSummary) ⇒ <code>void</code>
  * [.main()](#at_cldmv_slash_slothlet_slash_tools_slash_fix-headers_main) ⇒ <code>Promise.&lt;void&gt;</code>


**Example**
```js
node tools/fix-headers.mjs --dry-run
```
**Example**
```js
node tools/fix-headers.mjs --verbose
```





* * *

<a id="typedef_module_at_cldmv_slash_slothlet_slash_tools_slash_fix-headers_FixHeadersOptions"></a>

### @cldmv/slothlet/tools/fix-headers.FixHeadersOptions
> <p><strong style="font-size: 1.1em;"><p>Options accepted by the <code>fixHeaders</code> function from @cldmv/fix-headers.</p></strong></p>
> 
**Kind**: inner typedef of [<code>@cldmv/slothlet/tools/fix-headers</code>](#at_cldmv_slash_slothlet_slash_tools_slash_fix-headers)


* * *

<a id="typedef_module_at_cldmv_slash_slothlet_slash_tools_slash_fix-headers_FixHeadersResult"></a>

### @cldmv/slothlet/tools/fix-headers.FixHeadersResult
> <p><strong style="font-size: 1.1em;"><p>Result returned by the <code>fixHeaders</code> function from @cldmv/fix-headers.</p></strong></p>
> 
**Kind**: inner typedef of [<code>@cldmv/slothlet/tools/fix-headers</code>](#at_cldmv_slash_slothlet_slash_tools_slash_fix-headers)


* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_fix-headers_showHelp"></a>

### @cldmv/slothlet/tools/fix-headers.showHelp() ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Print CLI help.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/fix-headers</code>](#at_cldmv_slash_slothlet_slash_tools_slash_fix-headers)

**Returns**:

- <code>void</code> <p></p>


**Example**
```js
showHelp();
```



* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_fix-headers_parseArguments"></a>

### @cldmv/slothlet/tools/fix-headers.parseArguments(args) ⇒ <code>Object</code>
> <p><strong style="font-size: 1.1em;"><p>Parse CLI arguments into runner options.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/fix-headers</code>](#at_cldmv_slash_slothlet_slash_tools_slash_fix-headers)


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

<a id="at_cldmv_slash_slothlet_slash_tools_slash_fix-headers_buildOptions"></a>

### @cldmv/slothlet/tools/fix-headers.buildOptions(parsed) ⇒ <code>FixHeadersOptions</code>
> <p><strong style="font-size: 1.1em;"><p>Build fixHeaders options from parsed CLI args and project header config.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/fix-headers</code>](#at_cldmv_slash_slothlet_slash_tools_slash_fix-headers)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| parsed | <code>Object</code> |  | <p>Parsed CLI arguments.</p> |


**Returns**:

- <code>[FixHeadersOptions](#typedef_module_at_cldmv_slash_slothlet_slash_tools_slash_fix-headers_FixHeadersOptions)</code> <p>Options for @cldmv/fix-headers.</p>


**Example**
```js
const options = buildOptions({ dryRun: true });
```



* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_fix-headers_printSummary"></a>

### @cldmv/slothlet/tools/fix-headers.printSummary(result, opts) ⇒ <code>void</code>
> <p><strong style="font-size: 1.1em;"><p>Print the run result summary to stdout.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/fix-headers</code>](#at_cldmv_slash_slothlet_slash_tools_slash_fix-headers)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| result | <code>[FixHeadersResult](#typedef_module_at_cldmv_slash_slothlet_slash_tools_slash_fix-headers_FixHeadersResult)</code> |  | <p>Result from @cldmv/fix-headers.</p> |
| opts | <code>Object</code> |  | <p>Display options.</p> |


**Returns**:

- <code>void</code> <p></p>


**Example**
```js
printSummary(result, { verbose: true, diff: false, dryRun: false });
```



* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_fix-headers_main"></a>

### @cldmv/slothlet/tools/fix-headers.main() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Execute the compatibility wrapper.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/fix-headers</code>](#at_cldmv_slash_slothlet_slash_tools_slash_fix-headers)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p>Resolves when all header processing is complete.</p>


**Example**
```js
await main();
```




<a id="at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure"></a>

## @cldmv/slothlet/tools/inspect-api-structure
> <p><strong style="font-size: 1.1em;"><p>Debug tool to load a Slothlet instance and display the full API tree structure.</p></strong></p>
> 


**Structure**

  * [.ensureDevEnvFlags()](#at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure_ensureDevEnvFlags) ⇒ <code>boolean</code>
  * [.inspectApiStructure(obj, path, depth, maxDepth, visited)](#at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure_inspectApiStructure) ⇒ <code>Array.&lt;string&gt;</code>
  * [.forceMaterializeLazyFolders(api, useV2)](#at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure_forceMaterializeLazyFolders) ⇒ <code>Promise.&lt;void&gt;</code>
  * [.inspectApi(apiName, options)](#at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure_inspectApi) ⇒ <code>Promise.&lt;void&gt;</code>
  * [.materializeLazyStructure(obj, visited)](#at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure_materializeLazyStructure) ⇒ <code>Promise.&lt;void&gt;</code>
  * [.findCallablePaths(obj, basePath, visited, skipSelf, depth, maxDepth)](#at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure_findCallablePaths) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
  * [.main()](#at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure_main) ⇒ <code>Promise.&lt;void&gt;</code>





* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure_ensureDevEnvFlags"></a>

### @cldmv/slothlet/tools/inspect-api-structure.ensureDevEnvFlags() ⇒ <code>boolean</code>
> <p><strong style="font-size: 1.1em;"><p>Ensure slothlet dev conditions are set for V3.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/inspect-api-structure</code>](#at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure)

**Returns**:

- <code>boolean</code> <p>True if a child process was spawned.</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure_inspectApiStructure"></a>

### @cldmv/slothlet/tools/inspect-api-structure.inspectApiStructure(obj, path, depth, maxDepth, visited) ⇒ <code>Array.&lt;string&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Display the structure of an object or function recursively.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/inspect-api-structure</code>](#at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| obj | <code>any</code> |  | <p>Object to inspect</p> |
| [path] | <code>string</code> | <code>""</code> | <p>Current path for display</p> |
| [depth] | <code>number</code> | <code>0</code> | <p>Current recursion depth</p> |
| [maxDepth] | <code>number</code> | <code>8</code> | <p>Maximum depth to traverse</p> |
| [visited] | <code>WeakSet</code> | <code>new WeakSet()</code> | <p>Visited objects to prevent cycles</p> |


**Returns**:

- <code>Array.&lt;string&gt;</code> <p>Array of formatted strings describing the structure</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure_forceMaterializeLazyFolders"></a>

### @cldmv/slothlet/tools/inspect-api-structure.forceMaterializeLazyFolders(api, useV2) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Force materialization of lazy folders by directly accessing their properties.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/inspect-api-structure</code>](#at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| api | <code>any</code> |  | <p>The API object to materialize</p> |
| useV2 | <code>boolean</code> |  | <p>Whether v2 behavior should be used</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure_inspectApi"></a>

### @cldmv/slothlet/tools/inspect-api-structure.inspectApi(apiName, options) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Main inspection function that loads an API and displays its structure.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/inspect-api-structure</code>](#at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| apiName | <code>string</code> |  | <p>Name of the API folder in api_tests (e.g., &quot;api_test&quot;, &quot;api_test_cjs&quot;)</p> |
| [options] | <code>object</code> |  | <p>Options for display</p> |
| [options.maxDepth] | <code>number</code> | <code>8</code> | <p>Maximum depth to traverse</p> |
| [options.showMethods] | <code>boolean</code> | <code>false</code> | <p>Whether to show available methods for functions</p> |
| [options.raw] | <code>boolean</code> | <code>false</code> | <p>Output only the raw API via console.log</p> |
| [options.slothletConfig] | <code>object</code> |  | <p>Configuration for slothlet initialization</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure_materializeLazyStructure"></a>

### @cldmv/slothlet/tools/inspect-api-structure.materializeLazyStructure(obj, visited) ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Recursively materializes lazy proxy structures by calling their _materialize methods.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/inspect-api-structure</code>](#at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| obj | <code>any</code> |  | <p>Object to materialize</p> |
| [visited] | <code>WeakSet</code> |  | <p>Visited objects tracker to prevent infinite recursion</p> |


**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>



* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure_findCallablePaths"></a>

### @cldmv/slothlet/tools/inspect-api-structure.findCallablePaths(obj, basePath, visited, skipSelf, depth, maxDepth) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Finds all callable paths in an API object structure.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/inspect-api-structure</code>](#at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| obj | <code>any</code> |  | <p>Object to traverse</p> |
| [basePath] | <code>string</code> | <code>"api"</code> | <p>Base path string</p> |
| [visited] | <code>WeakSet</code> |  | <p>Visited objects tracker</p> |
| [skipSelf] | <code>boolean</code> | <code>false</code> | <p>Skip adding the object itself as callable (to avoid duplicates)</p> |
| [depth] | <code>number</code> | <code>0</code> | <p>Current depth</p> |
| [maxDepth] | <code>number</code> | <code>8</code> | <p>Maximum depth to traverse</p> |


**Returns**:

- <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> <p>Array of callable paths</p>



* * *

<a id="at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure_main"></a>

### @cldmv/slothlet/tools/inspect-api-structure.main() ⇒ <code>Promise.&lt;void&gt;</code>
> <p><strong style="font-size: 1.1em;"><p>Main entry point for the utility.</p></strong></p>
> 
**Kind**: inner method of [<code>@cldmv/slothlet/tools/inspect-api-structure</code>](#at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure)

**Returns**:

- <code>Promise.&lt;void&gt;</code> <p></p>




<a id="at_cldmv_slash_slothlet_slash_tools_slash_precommit-validation"></a>

## @cldmv/slothlet/tools/precommit-validation
> <p><strong style="font-size: 1.1em;"><p>Pre-commit validation tool that runs the mandatory validation sequence and only allows commits if all tests pass.</p></strong></p>
> 










