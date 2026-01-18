/**
 * @fileoverview Lazy mode implementation - deferred loading with proxies
 * @module @cldmv/slothlet/modes/lazy
 */
import { SlothletError } from "@cldmv/slothlet/errors";
import { loadModule, scanDirectory, hasValidExports, extractExports, mergeExportsIntoAPI } from "@cldmv/slothlet/helpers/loader";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
import { processRootFiles, applyRootContributor } from "@cldmv/slothlet/helpers/modes";
import { createOuterProxy } from "@cldmv/slothlet/helpers/proxy";

/**
 * Build API in lazy mode (proxy-based deferred loading)
 * @param {Object} options - Build options
 * @param {string} options.dir - Directory to build from
 * @param {Object} options.ownership - Ownership manager
 * @param {Object} [options.config={}] - Configuration
 * @returns {Promise<Object>} Built API object with lazy proxies
 * @public
 */
export async function buildLazyAPI({ dir, ownership, config = {} }) {
	const api = {};

	// Scan directory structure
	const structure = await scanDirectory(dir);

	// Process root files (with root contributor pattern support)
	const rootDefaultFunction = await processRootFiles(api, structure.files, ownership, config, "lazy");

	// Create outer getter proxies for directories (with lazy materialization)
	for (const directory of structure.directories) {
		const propName = sanitizePropertyName(directory.name);
		api[propName] = createLazyProxy(directory, ownership, propName, config);
	}

	// Apply root contributor pattern: if a root function exists, make it THE api
	const finalApi = await applyRootContributor(api, rootDefaultFunction, config, "lazy");

	return finalApi;
}

/**
 * Create lazy proxy with background materialization
 * @param {Object} dir - Directory structure
 * @param {Object} ownership - Ownership manager
 * @param {string} apiPath - Current API path
 * @param {Object} config - Configuration
 * @returns {Proxy} Lazy proxy that materializes on access
 * @private
 */
function createLazyProxy(dir, ownership, apiPath, config) {
	let outerProxy;
	// Initialize with dummy functions to avoid circular dependency during proxy creation
	let setImpl = () => {};
	let getState = () => ({ materialized: false, inFlight: false });
	let getImpl = () => null;

	// Materialization function
	async function materializeImpl() {
		const state = getState();
		console.log(`[MATERIALIZE] ${apiPath} - state:`, { materialized: state.materialized, inFlight: state.inFlight });
		if (state.inFlight || state.materialized) return;

		state.inFlight = true;
		console.log(`[MATERIALIZE] ${apiPath} - Starting...`);

		try {
			const materialized = {};

			// Load files in directory
			for (const file of dir.children.files) {
				const mod = await loadModule(file.path);
				const exports = extractExports(mod);
				const moduleName = sanitizePropertyName(file.name);
				console.log(`[MATERIALIZE] ${apiPath} - Loaded ${moduleName}`);

				// Register ownership
				if (ownership) {
					ownership.register({
						moduleId: file.moduleId,
						apiPath: `${apiPath}.${moduleName}`,
						source: "core"
					});
				}

				// Merge exports into materialized object
				mergeExportsIntoAPI(materialized, exports, moduleName);
			}

			// Create lazy proxies for subdirectories
			for (const subdir of dir.children.directories || []) {
				const propName = sanitizePropertyName(subdir.name);
				materialized[propName] = createLazyProxy(subdir, ownership, `${apiPath}.${propName}`, config);
			}

			console.log(`[MATERIALIZE] ${apiPath} - Completed, keys:`, Object.keys(materialized));
			// Update __impl with materialized object
			setImpl(materialized);
		} catch (error) {
			console.error(`[MATERIALIZE] ${apiPath} - Error:`, error);
			state.inFlight = false;
			throw error;
		}
	}

	// Create outer proxy (pass null for materializeFunc since we handle it in wrapper)
	outerProxy = createOuterProxy(apiPath, null, null);

	// Get direct references to helper methods from the outer proxy (before wrapping)
	// Use Object.getOwnPropertyDescriptor to bypass any proxy traps
	const setImplDesc = Object.getOwnPropertyDescriptor(outerProxy, "__setImpl");
	const getStateDesc = Object.getOwnPropertyDescriptor(outerProxy, "__getState");
	const getImplDesc = Object.getOwnPropertyDescriptor(outerProxy, "__getImpl");

	setImpl = setImplDesc ? setImplDesc.value : setImpl;
	getState = getStateDesc ? getStateDesc.value : getState;
	getImpl = getImplDesc ? getImplDesc.value : getImpl;

	console.log(`[INIT] ${apiPath} - Got real methods:`, {
		setImpl: typeof setImpl,
		getState: typeof getState,
		getImpl: typeof getImpl
	});

	// Wrap to add thenable behavior and trigger materialization
	const wrappedProxy = new Proxy(outerProxy, {
		get(target, prop, receiver) {
			console.log(`[LAZY GET] ${apiPath}.${String(prop)}, getState valid:`, typeof getState === "function");
			// Pass through special helper methods
			if (prop === "__setImpl") return setImpl;
			if (prop === "__getState") return getState;
			if (prop === "__getImpl") return getImpl;

			// Only do lazy logic if getState is the real function (not dummy)
			if (getState && typeof getState === "function") {
				const state = getState();
				console.log(`[LAZY GET] ${apiPath}.${String(prop)} - state:`, state);

				// Trigger materialization on first access (except special props)
				if (
					!state.materialized &&
					!state.inFlight &&
					prop !== "__impl" &&
					prop !== "__state" &&
					prop !== "__slothletPath" &&
					prop !== "then" &&
					prop !== "constructor"
				) {
					console.log(`[LAZY GET] ${apiPath}.${String(prop)} - Triggering materialization`);
					materializeImpl();
				}

				// If not materialized and not a special prop, return thenable
				if (
					!state.materialized &&
					prop !== "__impl" &&
					prop !== "__state" &&
					prop !== "__slothletPath" &&
					prop !== "then" &&
					prop !== "constructor"
				) {
					console.log(`[LAZY GET] ${apiPath}.${String(prop)} - Returning thenable`);
					return createThenable(apiPath, prop, state, () => getImpl());
				}
			}

			const result = Reflect.get(target, prop, receiver);
			console.log(`[LAZY GET] ${apiPath}.${String(prop)} - Returning:`, typeof result);
			return result;
		},

		apply(target, thisArg, args) {
			if (getState && typeof getState === "function") {
				const state = getState();

				// Trigger materialization on function call
				if (!state.materialized && !state.inFlight) {
					materializeImpl();
				}

				// If not materialized, return promise
				if (!state.materialized) {
					return new Promise((resolve, reject) => {
						const checkMaterialized = () => {
							if (state.materialized) {
								const impl = getImpl();
								if (typeof impl === "function") {
									resolve(impl(...args));
								} else {
									reject(
										new SlothletError(
											"INVALID_CONFIG_LAZY_NOT_A_FUNCTION",
											{
												apiPath,
												actualType: typeof impl
											},
											null,
											{ validationError: true }
										)
									);
								}
							} else if (!state.inFlight) {
								reject(new SlothletError("INVALID_CONFIG_LAZY_MATERIALIZATION_FAILED", { apiPath }, null, { validationError: true }));
							} else {
								setImmediate(checkMaterialized);
							}
						};
						checkMaterialized();
					});
				}
			}

			return Reflect.apply(target, thisArg, args);
		},

		has(target, prop) {
			if (getState && typeof getState === "function") {
				const state = getState();
				if (!state.materialized && !state.inFlight) {
					materializeImpl();
				}
			}
			return Reflect.has(target, prop);
		},

		ownKeys(target) {
			if (getState && typeof getState === "function") {
				const state = getState();
				if (!state.materialized && !state.inFlight) {
					materializeImpl();
				}
			}
			return Reflect.ownKeys(target);
		}
	});

	return wrappedProxy;
}

/**
 * Create a thenable proxy that waits for parent materialization
 * @param {string} parentPath - Parent API path
 * @param {string|symbol} prop - Property being accessed
 * @param {Object} parentState - Parent materialization state
 * @param {Function} getImpl - Function to get parent's __impl
 * @returns {Proxy} Thenable proxy that resolves after parent materialization
 * @private
 */
function createThenable(parentPath, prop, parentState, getImpl) {
	const path = `${parentPath}.${String(prop)}`;
	const thenableTarget = function thenable() {};

	// Mark as thenable so runtime wrapper doesn't wrap it
	thenableTarget.__slothletThenable = true;

	return new Proxy(thenableTarget, {
		get(___target, nestedProp) {
			console.log(`[THENABLE GET] ${path}.${String(nestedProp)}, parentState:`, parentState);
			if (nestedProp === "then") return undefined;

			// If parent is materialized, access through __impl
			if (parentState.materialized) {
				const impl = getImpl();
				if (impl && impl[prop]) {
					return impl[prop][nestedProp];
				}
			}

			// Return another thenable
			return createThenable(path, nestedProp, parentState, () => {
				const impl = getImpl();
				return impl ? impl[prop] : null;
			});
		},

		apply(___target, ___thisArg, args) {
			// If parent is materialized, call the function
			if (parentState.materialized) {
				const impl = getImpl();
				if (impl && typeof impl[prop] === "function") {
					return impl[prop](...args);
				}
			}

			// Not materialized - return promise
			return new Promise((resolve, reject) => {
				const checkMaterialized = () => {
					if (parentState.materialized) {
						const impl = getImpl();
						if (impl && typeof impl[prop] === "function") {
							resolve(impl[prop](...args));
						} else {
							reject(
								new SlothletError(
									"INVALID_CONFIG_LAZY_NOT_A_FUNCTION",
									{
										propertyPath: path,
										actualType: typeof (impl ? impl[prop] : undefined)
									},
									null,
									{ validationError: true }
								)
							);
						}
					} else if (!parentState.inFlight) {
						reject(
							new SlothletError("INVALID_CONFIG_LAZY_MATERIALIZATION_FAILED", { propertyPath: path }, null, { validationError: true })
						);
					} else {
						setImmediate(checkMaterialized);
					}
				};
				checkMaterialized();
			});
		}
	});
}
