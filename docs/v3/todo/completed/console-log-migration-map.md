# Console.log to slothlet.debug() Migration Map

**Generated:** January 24, 2026  
**Total console.log calls to migrate:** 85

This document provides exact mappings for converting all console.log calls to the new `slothlet.debug()` system.

---

## File: src/slothlet.mjs (1 console.warn)

### Line 88
**Current:**
```javascript
console.warn(`[INIT] Skipped ${file}: ${error.message}`);
```

**Replace with:**
```javascript
new this.SlothletWarning("WARNING_INIT_COMPONENT_SKIPPED", {
	file,
	error: error.message
});
```

---

## File: src/lib/builders/api-assignment.mjs (6 console.logs)

### Line 158
**Current:**
```javascript
console.log(`[mergeApiObjects ENTRY] targetApi type=${typeof targetApi}, sourceApi type=${typeof sourceApi}`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "mergeApiObjects entry",
	targetApiType: typeof targetApi,
	sourceApiType: typeof sourceApi
});
```

### Line 159
**Current:**
```javascript
console.log(`[mergeApiObjects ENTRY] sourceApi keys:`, sourceApi ? Object.keys(sourceApi) : "N/A");
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "mergeApiObjects sourceApi keys",
	sourceApiKeys: sourceApi ? Object.keys(sourceApi) : []
});
```

### Line 165
**Current:**
```javascript
console.log(`[mergeApiObjects EXIT] sourceApi is not an object/function`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "mergeApiObjects exit - sourceApi not object/function"
});
```

### Line 179
**Current:**
```javascript
console.log(`[mergeApiObjects] Processing key="${key}", targetHas=${targetHas}, targetValue type=${typeof targetValue}, sourceValue type=${typeof sourceValue}`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "mergeApiObjects processing key",
	key,
	targetHas,
	targetValueType: typeof targetValue,
	sourceValueType: typeof sourceValue
});
```

### Line 194
**Current:**
```javascript
console.log(`[mergeApiObjects] Both plain objects - recursing`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "mergeApiObjects - both plain objects, recursing",
	key
});
```

### Line 200
**Current:**
```javascript
console.log(`[mergeApiObjects] Calling assignToApiPath for key="${key}"`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "mergeApiObjects calling assignToApiPath",
	key
});
```

---

## File: src/lib/builders/modes-processor.mjs (35 console.logs)

### Line 77
**Current:**
```javascript
console.log(`[CATEGORY REUSE] Reusing existing wrapper for categoryName="${categoryName}", apiPath="${categoryPath}"`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Category reuse - using existing wrapper",
	categoryName,
	apiPath: categoryPath
});
```

### Line 89
**Current:**
```javascript
console.log(`[CATEGORY WRAPPER CREATED] categoryName="${categoryName}", apiPath="${categoryPath}"`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Category wrapper created",
	categoryName,
	apiPath: categoryPath
});
```

### Line 98
**Current:**
```javascript
console.log(`[CATEGORY WRAPPER ASSIGNED] api["${categoryName}"] is now a wrapper`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Category wrapper assigned to API",
	categoryName
});
```

### Line 102
**Current:**
```javascript
console.log(`[CATEGORY CREATED] Created new category wrapper for categoryName="${categoryName}", apiPath="${categoryPath}"`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Category created",
	categoryName,
	apiPath: categoryPath
});
```

### Line 103
**Current:**
```javascript
console.log(`[CATEGORY CREATED] targetApi is wrapper: ${!!targetApi.__wrapper}, targetApi keys:`, Object.keys(targetApi));
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Category targetApi status",
	isWrapper: !!targetApi.__wrapper,
	targetApiKeys: Object.keys(targetApi)
});
```

### Line 109
**Current:**
```javascript
console.log(await t("DEBUG_MODE_PROCESSING_DIRECTORY", { mode, categoryName, currentDepth: depth }));
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: await t("DEBUG_MODE_PROCESSING_DIRECTORY", { mode, categoryName, currentDepth: depth })
});
```

### Line 116
**Current:**
```javascript
console.log(`[PROCESS FILE] categoryName=${categoryName}, module=${moduleName}, implKeys=${Object.keys(impl).join(",")}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Processing file",
	categoryName,
	module: moduleName,
	implKeys: Object.keys(impl)
});
```

### Line 145
**Current:**
```javascript
console.log(`[PROCESS MODULE] categoryName=logger, moduleName=logger, hasDefault=true, moduleKeys=, targetApi type=object, targetApi callable=false`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Processing module",
	categoryName,
	moduleName,
	hasDefault,
	moduleKeys,
	targetApiType: typeof targetApi,
	targetApiCallable: typeof targetApi === "function"
});
```

### Line 154
**Current:**
```javascript
console.log(`[FILE PROCESSING] module="${moduleName}", category="${categoryName || "(none)"}", isRoot=${isRoot}, hasDefault=${hasDefault}, moduleKeys=[${Object.keys(impl).join(",")}]`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "File processing",
	module: moduleName,
	category: categoryName || "(none)",
	isRoot,
	hasDefault,
	moduleKeys: Object.keys(impl)
});
```

### Line 184
**Current:**
```javascript
console.log(await t("DEBUG_MODE_MODULE_DECISION", { mode, moduleName, reason: decisionReason }));
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: await t("DEBUG_MODE_MODULE_DECISION", { mode, moduleName, reason: decisionReason })
});
```

### Line 225
**Current:**
```javascript
console.log(`[SINGLE-FILE FOLDER] categoryName=${categoryName}, moduleName=${moduleName}, flatten=${shouldFlatten}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Single-file folder detected",
	categoryName,
	moduleName,
	flatten: shouldFlatten
});
```

### Line 243
**Current:**
```javascript
console.log(`[SINGLE-FILE FOLDER] Set api.${categoryName} to wrapped property, keys=${Object.keys(impl)}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Single-file folder set to wrapped property",
	categoryName,
	implKeys: Object.keys(impl)
});
```

### Line 421
**Current:**
```javascript
console.log(`[FLATTEN MULTI-EXPORT] File "${moduleName}" in category "${categoryName}", has ${Object.keys(impl).length} exports`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Flatten multi-export file",
	moduleName,
	categoryName,
	exportCount: Object.keys(impl).length
});
```

### Line 422
**Current:**
```javascript
console.log(`[FLATTEN MULTI-EXPORT] targetApi is wrapper: ${!!targetApi.__wrapper}, keys before: ${Object.keys(targetApi).join(",")}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Flatten multi-export targetApi status",
	isWrapper: !!targetApi.__wrapper,
	keysBefore: Object.keys(targetApi)
});
```

### Line 428
**Current:**
```javascript
console.log(`[FLATTEN MULTI-EXPORT] Assigning export "${key}" to targetApi`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Flatten multi-export assigning key",
	key
});
```

### Line 442
**Current:**
```javascript
console.log(`[FLATTEN MULTI-EXPORT] ✓ Assigned "${key}" to targetApi, keys after: ${Object.keys(targetApi).join(",")}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Flatten multi-export key assigned successfully",
	key,
	keysAfter: Object.keys(targetApi)
});
```

### Line 444
**Current:**
```javascript
console.log(`[FLATTEN MULTI-EXPORT] ⚠ safeAssign blocked "${key}"`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Flatten multi-export key blocked by safeAssign",
	key
});
```

### Line 518
**Current:**
```javascript
console.log(`[FILE WRAPPER ASSIGNMENT] propertyName="${propertyName}", apiPath="${apiPath}", overwriting="${alreadyExists ? "existing" : "nothing"}"`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "File wrapper assignment",
	propertyName,
	apiPath,
	overwriting: alreadyExists ? "existing" : "nothing"
});
```

### Line 532
**Current:**
```javascript
console.log(`[AFTER ASSIGN] targetApi type=${typeof targetApi}, propertyName=${propertyName}, has property=${!!targetApi[propertyName]}, _impl type=${typeof targetApi.__wrapper?._impl}, _impl.${propertyName}=${targetApi.__wrapper?._impl?.[propertyName]}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "After assignment status",
	targetApiType: typeof targetApi,
	propertyName,
	hasProperty: !!targetApi[propertyName],
	implType: typeof targetApi.__wrapper?._impl,
	implHasProperty: !!targetApi.__wrapper?._impl?.[propertyName]
});
```

### Line 553
**Current:**
```javascript
console.log(`[SUBDIR CHECK] isRoot=${isRoot}, categoryName=${categoryName || "null"}, directory=${!!directory}, children=${!!directory?.children}, directories=${directory?.children?.directories?.length || 0}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Subdirectory check",
	isRoot,
	categoryName: categoryName || "null",
	hasDirectory: !!directory,
	hasChildren: !!directory?.children,
	directoryCount: directory?.children?.directories?.length || 0
});
```

### Line 557
**Current:**
```javascript
console.log(`[DIRECTORY CHECK] directory.children exists: ${!!directory?.children}, directories exists: ${!!directory?.children?.directories}, length: ${directory?.children?.directories?.length || 0}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Directory check",
	hasChildren: !!directory?.children,
	hasDirectories: !!directory?.children?.directories,
	length: directory?.children?.directories?.length || 0
});
```

### Line 561
**Current:**
```javascript
console.log(`[DIRECTORY CHECK PASSED] Will check recursive flag: ${recursive}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Directory check passed",
	recursive
});
```

### Line 563
**Current:**
```javascript
console.log(`[SUBDIR FOUND] Processing ${directory.children.directories.length} subdirectories, recursive=${recursive}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Subdirectories found",
	subdirectoryCount: directory.children.directories.length,
	recursive
});
```

### Line 567
**Current:**
```javascript
console.log(`[SUBDIRECTORY LOOP] directory.children.directories.length=${directory.children.directories.length}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Subdirectory loop start",
	count: directory.children.directories.length
});
```

### Line 569
**Current:**
```javascript
console.log(`[PROCESSING SUBDIRECTORY] name="${subDir.name}", fileCount=${subDir.children?.files?.length || 0}, subdirCount=${subDir.children?.directories?.length || 0}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Processing subdirectory",
	name: subDir.name,
	fileCount: subDir.children?.files?.length || 0,
	subdirCount: subDir.children?.directories?.length || 0
});
```

### Line 587
**Current:**
```javascript
console.log(`[FOLDER-LEVEL FLATTEN CHECK] subDir="${subDirName}", file="${file.name}", isGeneric=${isGeneric}, filenameMatches=${filenameMatches}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Folder-level flatten check",
	subDir: subDirName,
	file: file.name,
	isGeneric,
	filenameMatches
});
```

### Line 613
**Current:**
```javascript
console.log(`[FOLDER-LEVEL FLATTEN] Flattening "${subDirName}" folder, SKIPPING regular processFiles recursion`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Folder-level flatten - skipping recursion",
	subDir: subDirName
});
```

### Line 683
**Current:**
```javascript
console.log(`[LAZY SUBDIR] Creating for ${apiPath}, files=${subDir.children.files.length}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Creating lazy subdirectory",
	apiPath,
	fileCount: subDir.children.files.length
});
```

### Line 705
**Current:**
```javascript
console.log(await t("DEBUG_MODE_ROOT_CONTRIBUTOR", { mode, functionName: defaultExport.name }));
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: await t("DEBUG_MODE_ROOT_CONTRIBUTOR", { mode, functionName: defaultExport.name })
});
```

### Line 777
**Current:**
```javascript
console.log(`[MATERIALIZE FUNC] Starting for dir=${dir.name}, files=${dir.children.files.length}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Materialize function starting",
	dir: dir.name,
	fileCount: dir.children.files.length
});
```

### Line 862
**Current:**
```javascript
console.log(`[MATERIALIZE FUNC] Returning impl for dir=${dir.name}, keys=${Object.keys(impl).join(",")}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Materialize function returning impl",
	dir: dir.name,
	keys: Object.keys(impl)
});
```

### Line 869
**Current:**
```javascript
console.log(`[FOLDER PATTERN MATCH] dir=${dir.name}, categoryName=${categoryName}, hasDefaultExport=${hasDefaultExport}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Folder pattern match",
	dir: dir.name,
	categoryName,
	hasDefaultExport
});
```

### Line 876
**Current:**
```javascript
console.log(`[FOLDER PATTERN ATTACH] ${categoryName}.${key} = ${typeof materialized[key]}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Folder pattern attach property",
	categoryName,
	key,
	valueType: typeof materialized[key]
});
```

### Line 882
**Current:**
```javascript
console.log(`[FOLDER PATTERN RETURN] Returning ${categoryName} with keys: ${Object.keys(folderExport).join(",")}`);
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: "Folder pattern return",
	categoryName,
	keys: Object.keys(folderExport)
});
```

### Line 931
**Current:**
```javascript
console.log(await t("DEBUG_MODE_ROOT_CONTRIBUTOR_APPLIED", { mode, properties: Object.keys(api).length }));
```

**Replace with:**
```javascript
this.slothlet.debug("modes", {
	message: await t("DEBUG_MODE_ROOT_CONTRIBUTOR_APPLIED", { mode, properties: Object.keys(api).length })
});
```

---

## File: src/lib/handlers/api-manager.mjs (38 console.logs)

### Line 279
**Current:**
```javascript
console.log(`[syncWrapper ENTRY] existingProxy apiPath:`, existingProxy?.__wrapper?.apiPath);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "syncWrapper entry - existingProxy",
	apiPath: existingProxy?.__wrapper?.apiPath
});
```

### Line 280
**Current:**
```javascript
console.log(`[syncWrapper ENTRY] nextProxy apiPath:`, nextProxy?.__wrapper?.apiPath);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "syncWrapper entry - nextProxy",
	apiPath: nextProxy?.__wrapper?.apiPath
});
```

### Line 291
**Current:**
```javascript
console.log(`[syncWrapper] existingWrapper.apiPath: ${existingWrapper.apiPath}`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "syncWrapper existingWrapper",
	apiPath: existingWrapper.apiPath
});
```

### Line 292
**Current:**
```javascript
console.log(`[syncWrapper] nextWrapper.apiPath: ${nextWrapper.apiPath}`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "syncWrapper nextWrapper",
	apiPath: nextWrapper.apiPath
});
```

### Line 305
**Current:**
```javascript
console.log(`[syncWrapper] Before merge - existing cache size: ${existingWrapper._childCache.size}`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "syncWrapper before merge",
	cacheSize: existingWrapper._childCache.size
});
```

### Line 308
**Current:**
```javascript
console.log(`[syncWrapper] Next wrapper _impl keys:`, Object.keys(nextWrapper._impl || {}));
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "syncWrapper next wrapper impl keys",
	implKeys: Object.keys(nextWrapper._impl || {})
});
```

### Line 309
**Current:**
```javascript
console.log(`[syncWrapper] Next wrapper _childCache keys:`, Array.from(nextWrapper._childCache.keys()));
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "syncWrapper next wrapper childCache keys",
	childCacheKeys: Array.from(nextWrapper._childCache.keys())
});
```

### Line 325
**Current:**
```javascript
console.log(`[syncWrapper] After merge - existing cache size: ${existingWrapper._childCache.size}`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "syncWrapper after merge",
	cacheSize: existingWrapper._childCache.size
});
```

### Line 357
**Current:**
```javascript
console.log(`[mutateApiValue] called - existing type: ${typeof existingValue}, next type: ${typeof nextValue}`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "mutateApiValue called",
	existingType: typeof existingValue,
	nextType: typeof nextValue
});
```

### Line 358
**Current:**
```javascript
console.log(`[mutateApiValue] existing isWrapper: ${this.isWrapperProxy(existingValue)}, next isWrapper: ${this.isWrapperProxy(nextValue)}`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "mutateApiValue wrapper status",
	existingIsWrapper: this.isWrapperProxy(existingValue),
	nextIsWrapper: this.isWrapperProxy(nextValue)
});
```

### Line 361
**Current:**
```javascript
console.log(`[mutateApiValue] nextValue:`, nextValue);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "mutateApiValue nextValue",
	nextValue
});
```

### Line 362
**Current:**
```javascript
console.log(`[mutateApiValue] nextValue keys:`, nextValue ? Object.keys(nextValue) : "N/A");
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "mutateApiValue nextValue keys",
	nextValueKeys: nextValue ? Object.keys(nextValue) : []
});
```

### Line 372
**Current:**
```javascript
console.log(`[mutateApiValue] Both are wrappers - calling syncWrapper`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "mutateApiValue - both are wrappers, calling syncWrapper"
});
```

### Line 386
**Current:**
```javascript
console.log(`[mutateApiValue] Merging object/function properties into existing wrapper`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "mutateApiValue - merging properties into existing wrapper"
});
```

### Line 387
**Current:**
```javascript
console.log(`[mutateApiValue] nextValue keys:`, Object.keys(nextValue));
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "mutateApiValue nextValue keys to merge",
	keys: Object.keys(nextValue)
});
```

### Line 400
**Current:**
```javascript
console.log(`[mutateApiValue] Using __setImpl fallback`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "mutateApiValue - using __setImpl fallback"
});
```

### Line 453
**Current:**
```javascript
console.log(`[setValueAtPath] finalKey="${finalKey}", parts=[${parts.join(",")}], collision=${collision}`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "setValueAtPath",
	finalKey,
	parts,
	collision
});
```

### Line 469
**Current:**
```javascript
console.log(`[setValueAtPath] Skipping collision at ${parts.join(".")} (mode: skip)`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "setValueAtPath - skipping collision",
	path: parts.join("."),
	mode: "skip"
});
```

### Line 487
**Current:**
```javascript
console.log("[setValueAtPath] Merging properties (mode: merge)");
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "setValueAtPath - merging properties",
	mode: "merge"
});
```

### Line 503
**Current:**
```javascript
console.log(`[setValueAtPath] No collision - assigning: parent["${finalKey}"] = value`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "setValueAtPath - no collision, assigning",
	finalKey
});
```

### Lines 728-763 (Debug structure dump - 16 console.logs)
**Current:** Multiple console.log statements forming a debug structure dump

**Replace entire block with:**
```javascript
this.slothlet.debug("api", {
	message: "addApiComponent buildAPI return structure",
	topLevelKeys: Object.keys(newApi),
	dottedKeys: Object.keys(newApi).filter(k => k.includes(".")),
	wrappers: Object.keys(newApi)
		.filter(k => newApi[k]?.__wrapper)
		.map(k => ({
			key: k,
			apiPath: newApi[k].__wrapper.apiPath,
			implKeys: Object.keys(newApi[k].__wrapper._impl || {}),
			childCacheSize: newApi[k].__wrapper._childCache?.size,
			childCacheKeys: Array.from(newApi[k].__wrapper._childCache?.keys() || [])
		})),
	nonWrappers: Object.keys(newApi)
		.filter(k => !newApi[k]?.__wrapper)
		.map(k => ({ key: k, type: typeof newApi[k] }))
});
```

### Line 774
**Current:**
```javascript
console.log(`[addApiComponent] finalKey: ${finalKey}, newApiKeys:`, newApiKeys);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "addApiComponent finalKey",
	finalKey,
	newApiKeys
});
```

### Line 778
**Current:**
```javascript
console.log(`[addApiComponent] Extracting ${finalKey}, isWrapper:`, this.isWrapperProxy(newApi[finalKey]));
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "addApiComponent extracting key",
	finalKey,
	isWrapper: this.isWrapperProxy(newApi[finalKey])
});
```

### Line 781
**Current:**
```javascript
console.log(`[hot_reload] Extracted ${finalKey} from newApi:`, Object.keys(apiToMerge));
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "hot_reload extracted key",
	finalKey,
	apiToMergeKeys: Object.keys(apiToMerge)
});
```

### Line 784
**Current:**
```javascript
console.log(`[addApiComponent] Using full newApi as apiToMerge (apiPathPrefix mode)`);
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "addApiComponent - using full newApi as apiToMerge",
	mode: "apiPathPrefix"
});
```

### Line 788
**Current:**
```javascript
console.log(`[hot_reload] apiToMerge keys:`, Object.keys(apiToMerge));
```

**Replace with:**
```javascript
this.slothlet.debug("api", {
	message: "hot_reload apiToMerge keys",
	keys: Object.keys(apiToMerge)
});
```

---

## File: src/lib/handlers/unified-wrapper.mjs (7 console.logs)

### Line 109
**Current:**
```javascript
console.log(`[UnifiedWrapper constructor] apiPath="${apiPath}": _impl has ${implKeys.length} keys:`, implKeys.slice(0, 5));
```

**Replace with:**
```javascript
this.slothlet.debug("wrapper", {
	message: "UnifiedWrapper constructor - impl keys",
	apiPath,
	keyCount: implKeys.length,
	keySample: implKeys.slice(0, 5)
});
```

### Line 113
**Current:**
```javascript
console.log(`[UnifiedWrapper constructor] apiPath="${apiPath}": after adopt, _childCache size=${this._childCache.size}, keys:`, Array.from(this._childCache.keys()).slice(0, 5));
```

**Replace with:**
```javascript
this.slothlet.debug("wrapper", {
	message: "UnifiedWrapper constructor - after adopt",
	apiPath,
	childCacheSize: this._childCache.size,
	childCacheKeySample: Array.from(this._childCache.keys()).slice(0, 5)
});
```

### Line 145
**Current:**
```javascript
console.log(`[__setImpl] apiPath=${this.apiPath}, newImpl keys=${Object.keys(newImpl || {}).join(",")}`);
```

**Replace with:**
```javascript
this.slothlet.debug("wrapper", {
	message: "__setImpl called",
	apiPath: this.apiPath,
	newImplKeys: Object.keys(newImpl || {})
});
```

### Line 177
**Current:**
```javascript
console.log(`[_materialize] START for apiPath=${this.apiPath}`);
```

**Replace with:**
```javascript
this.slothlet.debug("wrapper", {
	message: "_materialize start",
	apiPath: this.apiPath
});
```

### Line 185
**Current:**
```javascript
console.log(`[_materialize] Calling materializeFunc (no args, expects return value)...`);
```

**Replace with:**
```javascript
this.slothlet.debug("wrapper", {
	message: "_materialize calling materializeFunc",
	apiPath: this.apiPath
});
```

### Line 195
**Current:**
```javascript
console.log(`[_materialize] DONE! result=${typeof result}, keys=${Object.keys(result || {}).join(",")}`);
```

**Replace with:**
```javascript
this.slothlet.debug("wrapper", {
	message: "_materialize complete",
	apiPath: this.apiPath,
	resultType: typeof result,
	resultKeys: Object.keys(result || {})
});
```

### Line 202
**Current:**
```javascript
console.log(`[_materialize] ERROR: ${error.message}`);
```

**Replace with:**
```javascript
this.slothlet.debug("wrapper", {
	message: "_materialize error",
	apiPath: this.apiPath,
	error: error.message
});
```

---

## Summary Statistics

| File | Console.log Count | Debug Category |
|------|------------------|----------------|
| src/slothlet.mjs | 1 (console.warn) | N/A (use SlothletWarning) |
| src/lib/builders/api-assignment.mjs | 6 | `api` |
| src/lib/builders/modes-processor.mjs | 35 | `modes` |
| src/lib/handlers/api-manager.mjs | 38 | `api` |
| src/lib/handlers/unified-wrapper.mjs | 7 | `wrapper` |
| **TOTAL** | **87** | |

## Debug Categories Used

- **`modes`** - Mode processing (eager/lazy), directory scanning, file loading, materialization
- **`api`** - API construction, merging, hot-reload, assignment, collision handling
- **`wrapper`** - UnifiedWrapper lifecycle, materialization, impl management
- **`initialization`** - Component initialization (already done in slothlet.mjs)

## Migration Guidelines

1. **Always preserve context**: Include relevant variables as context object properties
2. **Use descriptive messages**: Clear action + outcome format ("syncWrapper after merge", not just "after merge")
3. **Structured data**: Pass objects/arrays as properties, not stringified
4. **Consistent naming**: Use property names that match variable names when possible
5. **Remove template literals**: Extract variables into context properties
6. **Remove debug wrappers**: Delete `if (config.debug?.xxx)` wrappers - debug() handles conditionals internally
7. **Category selection**: Use the most specific category (modes/api/wrapper/initialization)

## Testing After Migration

```bash
# 1. Verify no improper console.log calls remain
node tools/analyze-errors.mjs

# 2. Test with debug flags enabled
$env:NODE_ENV='development'
$env:NODE_OPTIONS='--conditions=slothlet-dev'
node tmp/test-debug-api.mjs

# 3. Run full test suite
npm run debug
npm test
```
