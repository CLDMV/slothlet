<a id="at_cldmv_slash_slothlet_slash_tools_slash_analyze-errors"></a>

## npm run analyze
> <p><strong style="font-size: 1.1em;"><p><strong>CLI Options:</strong></p>
> <table>
> <thead>
> <tr>
> <th>Option</th>
> <th>Description</th>
> </tr>
> </thead>
> <tbody>
> <tr>
> <td><code>--limit=&lt;n&gt;</code></td>
> <td>Limit reported issues per category (default: 10)</td>
> </tr>
> <tr>
> <td><code>--verbose</code></td>
> <td>Show extended context for each issue</td>
> </tr>
> </tbody>
> </table></strong></p>
> 




**Example**
```js
// Run via npm script
npm run analyze
```
**Example**
```js
// Limit output (default: 10)
npm run analyze -- --limit=25
```
**Example**
```js
// Verbose output
npm run analyze -- --verbose
```
**Example**
```js
// Combined
npm run analyze -- --verbose --limit=50
```






<a id="at_cldmv_slash_slothlet_slash_tools_slash_fix-headers"></a>

## npm run fix:headers
> <p><strong style="font-size: 1.1em;"><p><strong>CLI Options:</strong></p>
> <table>
> <thead>
> <tr>
> <th>Option</th>
> <th>Description</th>
> </tr>
> </thead>
> <tbody>
> <tr>
> <td><code>--dry-run</code></td>
> <td>Preview what would change without writing any files</td>
> </tr>
> <tr>
> <td><code>--diff</code></td>
> <td>Show a per-file diff of header changes</td>
> </tr>
> <tr>
> <td><code>--verbose</code></td>
> <td>Print each file examined</td>
> </tr>
> <tr>
> <td><code>--help</code></td>
> <td>Show usage information</td>
> </tr>
> </tbody>
> </table></strong></p>
> 




**Example**
```js
// Run via npm script
npm run fix:headers
```
**Example**
```js
// Preview changes without writing
npm run fix:headers -- --dry-run
```
**Example**
```js
// Show diff for each changed file
npm run fix:headers -- --diff
```
**Example**
```js
// Verbose output
npm run fix:headers -- --verbose
```






<a id="at_cldmv_slash_slothlet_slash_tools_slash_inspect-api-structure"></a>

## npm run inspect
> <p><strong style="font-size: 1.1em;"><p><strong>CLI Options:</strong></p>
> <table>
> <thead>
> <tr>
> <th>Option</th>
> <th>Default</th>
> <th>Description</th>
> </tr>
> </thead>
> <tbody>
> <tr>
> <td><code>&lt;api-name&gt;</code></td>
> <td>—</td>
> <td>Name of the <code>api_tests/</code> folder to load (required)</td>
> </tr>
> <tr>
> <td><code>--depth &lt;n&gt;</code></td>
> <td><code>8</code></td>
> <td>Maximum tree traversal depth</td>
> </tr>
> <tr>
> <td><code>--lazy</code></td>
> <td>✓</td>
> <td>Use lazy loading mode (default)</td>
> </tr>
> <tr>
> <td><code>--eager</code></td>
> <td></td>
> <td>Use eager loading mode</td>
> </tr>
> <tr>
> <td><code>--raw</code></td>
> <td></td>
> <td>Print raw <code>util.inspect</code> output only</td>
> </tr>
> <tr>
> <td><code>--runtime &lt;type&gt;</code></td>
> <td><code>async</code></td>
> <td>Context runtime: <code>async</code> or <code>live</code></td>
> </tr>
> <tr>
> <td><code>--apiDepth &lt;n&gt;</code></td>
> <td>unlimited</td>
> <td>Slothlet <code>apiDepth</code> config option</td>
> </tr>
> <tr>
> <td><code>--debug</code></td>
> <td></td>
> <td>Enable Slothlet debug output</td>
> </tr>
> <tr>
> <td><code>--allowMutation</code></td>
> <td></td>
> <td>Allow runtime API mutation</td>
> </tr>
> <tr>
> <td><code>--hooks</code></td>
> <td></td>
> <td>Enable lifecycle hooks</td>
> </tr>
> <tr>
> <td><code>--help</code> / <code>-h</code></td>
> <td></td>
> <td>Show usage information</td>
> </tr>
> </tbody>
> </table></strong></p>
> 




**Example**
```js
// Run via npm script (inspect api_test folder)
npm run inspect -- api_test
```
**Example**
```js
// Use eager loading
npm run inspect -- api_test --eager
```
**Example**
```js
// Override traversal depth
npm run inspect -- api_test --depth 4
```
**Example**
```js
// Use live runtime
npm run inspect -- api_test --runtime live
```
**Example**
```js
// Raw util.inspect output
npm run inspect -- api_test --raw
```






<a id="at_cldmv_slash_slothlet_slash_tools_slash_precommit-validation"></a>

## npm run precommit
> <p><strong style="font-size: 1.1em;"><p>No CLI options. The tool runs the full validation sequence unconditionally and
> prints a pass/fail summary. Exit code mirrors the result of the last failing step.</p></strong></p>
> 




**Example**
```js
// Run manually via npm script
npm run precommit
```








