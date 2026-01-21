# util Example

This folder demonstrates **filename-folder flattening** behavior alongside regular nested exports.

## Flattening Pattern

This folder shows multiple utility modules with various export patterns:

- **Files**: `util.mjs`, `controller.mjs`, `extract.mjs`, `url.mjs`
- **Features**: Live bindings, mixed flattening and nesting behavior
- **API Paths**: Mixed flattened and nested structures

## Modules

### util.mjs (Flattened Exports - Filename Matches Folder)

Because the filename matches the folder name (`util/util.mjs`), the exports are flattened to the parent namespace:

```js
api.util.size(variable); // 'size' - flattened from util.mjs
api.util.secondFunc(variable); // 'secondFunc' - flattened from util.mjs
```

### controller.mjs (Nested Object - Different Filename)

Controller-style module maintains nested structure because filename differs from folder:

```js
await api.util.controller.getDefault();
await api.util.controller.detectEndpointType();
await api.util.controller.detectDeviceType();
```

### extract.mjs (Nested Object - Different Filename)

Data extraction utilities maintain nested structure:

```js
api.util.extract.data();
api.util.extract.section();
api.util.extract.NVRSection();
api.util.extract.parseDeviceName();
```

### url.mjs (Nested Object - Different Filename)

URL manipulation utilities maintain nested structure:

```js
api.util.url.buildUrlWithParams();
api.util.url.cleanEndpoint();
```

## Filename-Folder Flattening Rule

**Key Pattern**: When `filename.mjs` matches the `folder/` name, exports are flattened to the folder level. When filenames differ from the folder name, they maintain their nested structure.

- `util/util.mjs` → exports flattened to `api.util.*`
- `util/controller.mjs` → exports nested as `api.util.controller.*`

## Live Bindings

The util modules demonstrate proper live binding usage:

```js
import { self, context, reference } from "@cldmv/slothlet/runtime";
```

## Use Case

This pattern shows how slothlet intelligently handles mixed export patterns within a single folder. The filename-folder matching provides a way to create "default" functionality for a namespace while allowing additional specialized modules to coexist in the same logical grouping.
