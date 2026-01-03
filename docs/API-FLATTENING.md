# API Flattening Rules

Slothlet includes intelligent API flattening to create cleaner, more intuitive API structures. This document explains how the flattening system works and when it applies.

## Overview

API flattening automatically removes unnecessary nesting levels when certain patterns are detected. Instead of `api.math.math.add()`, you get `api.math.add()`. The system analyzes your file structure and applies flattening rules to create the most ergonomic API possible.

## Table of Contents

- [The Five Flattening Rules](#the-five-flattening-rules)
- [Decision Tree](#decision-tree)
- [Benefits](#benefits)
- [Examples](#examples)

## The Seven Flattening Rules

Slothlet applies seven distinct flattening rules to eliminate redundant nesting:

### 1. Folder/File Name Matching

**When:** A folder contains a single file with a matching name (ignoring case and separators)

**Example:**

```text
math/
└── math.mjs → api.math (not api.math.math)
```

**Why:** Having `api.math.math.add()` is redundant when the folder and file names match.

### 2. Index File Pattern

**When:** A folder contains only `index.mjs` or `index.cjs`

**Example:**

```text
utils/
└── index.mjs → api.utils (not api.utils.index)
```

**Why:** Index files are typically used as folder entry points, so the "index" name should be transparent.

### 3. Single Named Export Matching Folder

**When:** A folder has one file, that file has one named export, and the export name matches the folder name

**Example:**

```text
config/
└── settings.mjs
	export const config = {...}
→ api.config (not api.config.settings.config)
```

**Why:** When there's a single export that matches the folder intent, intermediate names add no value.

### 4. Default Export in Matching File

**When:** Folder/file names match AND the file exports a default function/value

**Example:**

```text
logger/
└── logger.mjs
	export default function() {...}
→ api.logger() (not api.logger.logger())
```

**Why:** Default exports typically represent the primary purpose of the module, matching names should flatten.

### 5. Single File with Root-Level Default

**When:** A folder has one file with a default export that should become a top-level callable

**Example:**

```text
processor/
└── process.mjs
	export default function() {...}
→ api.processor() (not api.processor.process())
```

**Why:** When a folder's entire purpose is captured by a single default export, flatten to the folder name.

### 6. AddApi Special File Pattern

**When:** Files named `addapi.mjs` loaded via `addApi()` (Special Case)

**Example:**

```text
// Using api.addApi("plugins", "./plugin-folder")
plugin-folder/
└── addapi.mjs
	export function initializePlugin() {...}
	export function cleanup() {...}
→ api.plugins.initializePlugin() (not api.plugins.addapi.initializePlugin())
```

**Why:** `addapi.mjs` files are designed to extend existing API levels directly. They should never create an intermediate `addapi` namespace, regardless of the `autoFlatten` setting.

**Special Behavior:**

- **Always flattened:** Even when `autoFlatten=false` is specified
- **Extends parent level:** Merges exports directly into the target API path
- **Priority over other rules:** Takes precedence over standard flattening rules

### 7. AddApi Root-Level File Matching

**When:** Using `addApi()` where a file name at the root level matches the last segment of the API path

**Example:**

```text
// Using api.addApi("config", "./settings-folder")
settings-folder/
├── config.mjs          ← Root-level file matches API path segment "config"
│   export function getConfig() {...}
│   export function setConfig() {...}
├── utils.mjs
│   export function validate() {...}
└── config/             ← Subdirectory (NOT flattened)
    └── config.mjs
        export function getNestedConfig() {...}

→ api.config.getConfig() (root-level config.mjs flattened)
→ api.config.setConfig()
→ api.config.utils.validate() (utils.mjs preserved normally)
→ api.config.config.getNestedConfig() (subdirectory NOT flattened)
```

**Why:** When the API path segment matches a root-level file name, flattening eliminates redundant nesting. This applies only to the immediate root level of the added folder.

**Key Points:**

- **Root-level only:** Only applies to files at the immediate root of the folder being added
- **Subdirectories preserved:** Files in subdirectories follow normal flattening rules
- **Applies to addApi only:** This rule is specific to `addApi()` operations
- **Path segment matching:** Only the final segment of the API path is considered
- **Always active:** Works regardless of `autoFlatten` setting

## Decision Tree

```mermaid
flowchart TD
	A[Start: Analyze folder] --> AA{File named 'addapi'?}
	AA --> AAYES[Yes] --> AAResult[✓ Flatten: Rule 6<br/>AddApi special pattern]
	AA --> AANO[No] --> B{Single file in folder?}

	B --> BNO[No] --> Z[No flattening]
	B --> BYES[Yes] --> C{File name matches folder?}

	C --> CYES[Yes] --> D{Has default export?}
	D --> DYES[Yes] --> E[✓ Flatten: Rule 4<br/>Folder with matching default]
	D --> DNO[No] --> F[✓ Flatten: Rule 1<br/>Folder/file name match]

	C --> CNO[No] --> G{Is file named 'index'?}
	G --> GYES[Yes] --> H[✓ Flatten: Rule 2<br/>Index file pattern]
	G --> GNO[No] --> I{Single named export?}

	I --> IYES[Yes] --> J{Export name matches folder?}
	J --> JYES[Yes] --> K[✓ Flatten: Rule 3<br/>Named export match]
	J --> JNO[No] --> L{Has default export?}

	L --> LYES[Yes] --> M[✓ Flatten: Rule 5<br/>Single file default]
	L --> LNO[No] --> Z

	I --> INO[No] --> N{Has default export?}
	N --> NYES[Yes] --> M
	N --> NNO[No] --> Z

	AAResult --> O[Result: Flattened API]
	E --> O
	F --> O
	H --> O
	K --> O
	M --> O
	Z --> P[Result: Normal nesting]

	%% Slothlet brand colors - #9BC66B primary on dark theme
	style A fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style AA fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style B fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style C fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style D fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style G fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style I fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style J fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style L fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style N fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5

	%% Yes/No nodes - styled boxes
	style AAYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style AANO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style BNO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style BYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style CYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style CNO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style DYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style DNO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style GYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style GNO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style IYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style INO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style JYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style JNO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style LYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style LNO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style NYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
	style NNO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5

	%% Success states - primary green
	style AAResult fill:#0d1a0d,stroke:#9BC66B,stroke-width:3px,color:#9BC66B,opacity:0.5
	style E fill:#0d1a0d,stroke:#9BC66B,stroke-width:3px,color:#9BC66B,opacity:0.5
	style F fill:#0d1a0d,stroke:#9BC66B,stroke-width:3px,color:#9BC66B,opacity:0.5
	style H fill:#0d1a0d,stroke:#9BC66B,stroke-width:3px,color:#9BC66B,opacity:0.5
	style K fill:#0d1a0d,stroke:#9BC66B,stroke-width:3px,color:#9BC66B,opacity:0.5
	style M fill:#0d1a0d,stroke:#9BC66B,stroke-width:3px,color:#9BC66B,opacity:0.5

	%% Results - accent colors
	style O fill:#0d1a0d,stroke:#7FA94F,stroke-width:3px,color:#7FA94F,opacity:0.5
	style P fill:#1a1a1a,stroke:#B8D982,stroke-width:2px,color:#B8D982,opacity:0.5
	style Z fill:#1a1a1a,stroke:#B8D982,stroke-width:2px,color:#B8D982,opacity:0.5

	%% Arrow styling
	linkStyle default stroke:#9BC66B,stroke-width:3px,opacity:0.5
```

    style D fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style G fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style I fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style J fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style L fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style N fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5

    %% Yes/No nodes - styled boxes
    style BNO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style BYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style CYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style CNO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style DYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style DNO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style GYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style GNO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style IYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style INO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style JYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style JNO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style LYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style LNO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style NYES fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style NNO fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5

    %% Success states - primary green
    style E fill:#0d1a0d,stroke:#9BC66B,stroke-width:3px,color:#9BC66B,opacity:0.5
    style F fill:#0d1a0d,stroke:#9BC66B,stroke-width:3px,color:#9BC66B,opacity:0.5
    style H fill:#0d1a0d,stroke:#9BC66B,stroke-width:3px,color:#9BC66B,opacity:0.5
    style K fill:#0d1a0d,stroke:#9BC66B,stroke-width:3px,color:#9BC66B,opacity:0.5
    style M fill:#0d1a0d,stroke:#9BC66B,stroke-width:3px,color:#9BC66B,opacity:0.5

    %% Results - accent colors
    style O fill:#0d1a0d,stroke:#7FA94F,stroke-width:3px,color:#7FA94F,opacity:0.5
    style P fill:#1a1a1a,stroke:#B8D982,stroke-width:2px,color:#B8D982,opacity:0.5
    style Z fill:#1a1a1a,stroke:#B8D982,stroke-width:2px,color:#B8D982,opacity:0.5

    %% Arrow styling
    linkStyle default stroke:#9BC66B,stroke-width:3px,opacity:0.5

````

## Benefits

API flattening provides several key benefits:

### 1. Cleaner API Surface

**Without Flattening:**

```javascript
api.math.math.add(2, 3);
api.logger.logger.log("message");
api.config.config.get("key");
````

**With Flattening:**

```javascript
api.math.add(2, 3);
api.logger.log("message");
api.config.get("key");
```

### 2. Intuitive Organization

File structure aligns with API usage:

```text
math/math.mjs → api.math.add()
NOT → api.math.math.add()
```

### 3. Flexibility

Organize files by domain without API penalty:

```text
database/
└── database.mjs → api.database.query()

authentication/
└── index.mjs → api.authentication.login()
```

### 4. Smart Default Handling

Default exports promote to the logical level:

```text
validator/
└── validator.mjs
	export default function validate() {...}
→ api.validator() (callable)
```

## Examples

### Example 1: Math Module

**File Structure:**

```text
api/
└── math/
	└── math.mjs
```

**File Content:**

```javascript
// api/math/math.mjs
export function add(a, b) {
	return a + b;
}

export function subtract(a, b) {
	return a - b;
}
```

**Result:**

```javascript
api.math.add(2, 3); // 5 - Rule 1 applied
api.math.subtract(5, 2); // 3
```

### Example 2: Logger with Default Export

**File Structure:**

```text
api/
└── logger/
	└── logger.mjs
```

**File Content:**

```javascript
// api/logger/logger.mjs
export default function log(message) {
	console.log(message);
}

log.info = (msg) => console.log(`[INFO] ${msg}`);
log.error = (msg) => console.error(`[ERROR] ${msg}`);

export { log };
```

**Result:**

```javascript
api.logger("Hello"); // Rule 4 applied
api.logger.info("Info message");
api.logger.error("Error message");
```

### Example 3: Index File Pattern

**File Structure:**

```text
api/
└── utils/
	└── index.mjs
```

**File Content:**

```javascript
// api/utils/index.mjs
export function format(str) {
	return str.toUpperCase();
}

export function parse(str) {
	return str.toLowerCase();
}
```

**Result:**

```javascript
api.utils.format("hello"); // "HELLO" - Rule 2 applied
api.utils.parse("WORLD"); // "world"
```

### Example 4: Config Module

**File Structure:**

```text
api/
└── config/
	└── settings.mjs
```

**File Content:**

```javascript
// api/config/settings.mjs
export const config = {
	port: 3000,
	host: "localhost"
};
```

**Result:**

```javascript
api.config.port; // 3000 - Rule 3 applied
api.config.host; // "localhost"
```

### Example 5: Processor with Default

**File Structure:**

```text
api/
└── processor/
	└── process.mjs
```

**File Content:**

```javascript
// api/processor/process.mjs
export default function process(data) {
	return data.toUpperCase();
}
```

**Result:**

```javascript
api.processor("hello"); // "HELLO" - Rule 5 applied
```

### Example 6: AddApi Plugin Extensions

**File Structure:**

```text
plugins/
└── addapi.mjs
```

**File Content:**

```javascript
// plugins/addapi.mjs
export function initializePlugin() {
	return "Plugin initialized";
}

export function cleanup() {
	return "Plugin cleaned up";
}

export default {
	version: "1.0.0"
};
```

**AddApi Usage:**

```javascript
// Load plugins via addApi
await api.addApi("plugins", "./plugins");
```

**Result:**

```javascript
// Functions are flattened to the plugins level (Rule 6 applied)
api.plugins.initializePlugin(); // "Plugin initialized"
api.plugins.cleanup(); // "Plugin cleaned up"
api.plugins.version; // "1.0.0"

// NOT api.plugins.addapi.initializePlugin() - addapi namespace is removed
```

**Special Notes:**

- Always flattened regardless of `autoFlatten` setting
- `addapi.mjs` files extend the target API level directly
- Can coexist with other files in the same folder

---

For more information, see:

- [Module Structure Examples](MODULE-STRUCTURE.md) - Comprehensive module patterns
- [API Rules](API-RULES.md) - Complete transformation rules
- [API Rules Conditions](API-RULES-CONDITIONS.md) - Conditional logic reference
- [README](../README.md) - Main project documentation
