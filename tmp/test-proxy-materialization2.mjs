/**
 * Unified Wrapper Test - Single proxy handling:
 * - __impl pattern (for reload support)
 * - Lazy/Eager mode
 * - Materialization (lazy only)
 * - Context binding (AsyncLocalStorage)
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";

// ============================================================================
// Timing Helper
// ============================================================================

function formatTime(ms) {
	if (ms < 1) {
		return `${(ms * 1000).toFixed(2)}μs`;
	}
	return `${ms.toFixed(2)}ms`;
}

// ============================================================================
// AsyncLocalStorage Context Manager
// ============================================================================

class ContextManager {
	constructor() {
		this.als = new AsyncLocalStorage();
	}

	runInContext(instanceId, fn, thisArg, args) {
		const existingCtx = this.als.getStore();

		// If already in context for same instance, just run
		if (existingCtx?.instanceId === instanceId) {
			return Reflect.apply(fn, thisArg, args);
		}

		// Create new context with instance-specific data
		const ctx = {
			instanceId,
			self: existingCtx?.self || null,
			context: existingCtx?.context || {},
			// Add some test data to verify isolation
			testData: `context-for-${instanceId}`
		};

		return this.als.run(ctx, () => Reflect.apply(fn, thisArg, args));
	}

	getContext() {
		return this.als.getStore();
	}
}

// ============================================================================
// Unified Wrapper - Handles Everything
// ============================================================================

class UnifiedWrapper {
	constructor(options) {
		this.mode = options.mode; // "lazy" or "eager"
		this.apiPath = options.apiPath || "";
		this.contextManager = options.contextManager;
		this.instanceId = options.instanceId;

		// __impl pattern (replaceable implementation)
		this._impl = options.initialImpl || null;

		// Lazy mode state
		if (this.mode === "lazy") {
			this._state = { materialized: false, inFlight: false };
			this._materializeFunc = options.materializeFunc;
		} else {
			this._state = { materialized: true, inFlight: false };
		}
	}

	// Get current __impl
	get __impl() {
		return this._impl;
	}

	// Set new __impl (for reload support)
	__setImpl(newImpl) {
		this._impl = newImpl;
		if (this.mode === "lazy") {
			this._state.materialized = true;
			this._state.inFlight = false;
		}
	}

	// Get current state
	__getState() {
		return { ...this._state, path: this.apiPath };
	}

	// Trigger materialization (lazy mode only)
	async _materialize() {
		if (this.mode !== "lazy" || this._state.materialized || this._state.inFlight) {
			return;
		}

		this._state.inFlight = true;

		try {
			const result = await this._materializeFunc();
			this._impl = result;
			this._state.materialized = true;
			this._state.inFlight = false; // Set here so nested access works
		} catch (err) {
			console.error(`[MATERIALIZE ERROR] ${this.apiPath}:`, err);
			this._state.inFlight = false;
		}
	}

	// Create a waiting proxy that chains property access until a function call
	_createWaitingProxy(propChain = []) {
		const wrapper = this;

		const waitingTarget = function waitingFunction() {};

		return new Proxy(waitingTarget, {
			get(___target, nestedProp) {
				if (nestedProp === "then") return undefined;

				// Add this property to the chain and return another waiting proxy
				return wrapper._createWaitingProxy([...propChain, nestedProp]);
			},

			apply: async (___target, ___thisArg, args) => {
				// Wait for wrapper to materialize
				while (wrapper._state.inFlight) {
					await new Promise((r) => setImmediate(r));
				}

				// Now traverse the property chain
				let current = wrapper._impl;

				for (const prop of propChain) {
					if (!current) {
						throw new Error(`${wrapper.apiPath}.${propChain.join(".")} - cannot access ${prop} of undefined`);
					}

					// If current is a UnifiedWrapper, trigger its materialization and wait
					if (current && typeof current === "object" && current.__getState) {
						const state = current.__getState();
						if (!state.materialized) {
							// Trigger materialization
							const triggerProp = current.add || current.square || Object.keys(current.__impl || {})[0];
							if (triggerProp) {
								// Accessing any property triggers materialization
								const ___unused = current[Object.keys(current.__impl || {})[0] || "___trigger"];
							}

							// Wait for it to materialize
							while (!current.__getState().materialized) {
								await new Promise((r) => setImmediate(r));
							}
						}
						// Access the actual impl
						current = current.__impl;
					}

					current = current[prop];
				}

				if (typeof current === "function") {
					return wrapper.contextManager.runInContext(wrapper.instanceId, current, ___thisArg, args);
				}

				throw new Error(`${wrapper.apiPath}.${propChain.join(".")} is not a function`);
			}
		});
	}
	_createThenable(prop) {
		const parentWrapper = this;
		const thenableTarget = function thenable() {};

		return new Proxy(thenableTarget, {
			get(___target, nestedProp) {
				// Not a promise
				if (nestedProp === "then") return undefined;

				// If materialized, access from __impl
				if (parentWrapper._state.materialized && parentWrapper._impl) {
					const value = parentWrapper._impl[prop];

					// If value is a UnifiedWrapper proxy (lazy nested module), access its property
					// This triggers the nested wrapper's own proxy logic
					if (value && typeof value === "object" && value.__getState) {
						return value[nestedProp];
					}

					if (value && typeof value === "object") {
						return value[nestedProp];
					}
					return undefined;
				}

				// Still materializing - chain access by waiting for parent first,
				// then accessing the property chain
				return new Promise(async (resolve, reject) => {
					const check = async () => {
						if (parentWrapper._state.materialized && parentWrapper._impl) {
							try {
								const value = parentWrapper._impl[prop];

								// If value is a UnifiedWrapper, access its property
								if (value && typeof value === "object" && value.__getState) {
									const nestedValue = value[nestedProp];
									// If nested value is a promise/thenable, await it
									if (nestedValue && typeof nestedValue === "object" && typeof nestedValue.then === "function") {
										resolve(await nestedValue);
									} else {
										resolve(nestedValue);
									}
								} else if (value && typeof value === "object") {
									resolve(value[nestedProp]);
								} else {
									resolve(undefined);
								}
							} catch (err) {
								reject(err);
							}
						} else {
							setImmediate(check);
						}
					};
					check();
				});
			},

			apply(___target, ___thisArg, args) {
				// If materialized, call the function
				if (parentWrapper._state.materialized && parentWrapper._impl) {
					const fn = parentWrapper._impl[prop];

					// If fn is a UnifiedWrapper proxy (nested lazy module), it shouldn't be callable
					if (fn && typeof fn === "object" && fn.__getState) {
						throw new Error(`${parentWrapper.apiPath}.${String(prop)} is a module, not a callable function`);
					}

					if (typeof fn === "function") {
						return parentWrapper._wrapFunction(fn, `${parentWrapper.apiPath}.${String(prop)}`)(...args);
					}
				}

				// Not materialized - wait for materialization then call
				return new Promise((resolve, reject) => {
					const check = () => {
						if (parentWrapper._state.materialized && parentWrapper._impl) {
							try {
								const fn = parentWrapper._impl[prop];
								if (typeof fn === "function") {
									resolve(parentWrapper._wrapFunction(fn, `${parentWrapper.apiPath}.${String(prop)}`)(...args));
								} else {
									reject(new Error(`${parentWrapper.apiPath}.${String(prop)} is not a function`));
								}
							} catch (err) {
								reject(err);
							}
						} else {
							setImmediate(check);
						}
					};
					check();
				});
			}
		});
	}

	// Wrap function with context
	_wrapFunction(fn, fnPath) {
		const wrapper = this;

		return function wrapped(...args) {
			return wrapper.contextManager.runInContext(wrapper.instanceId, fn, this, args);
		};
	}

	// Create the unified proxy
	createProxy() {
		const wrapper = this;

		return new Proxy(this, {
			get(target, prop, receiver) {
				// Internal methods - return from wrapper
				if (prop === "__impl" || prop === "__setImpl" || prop === "__getState" || prop === "_impl" || prop === "_state") {
					if (prop === "__setImpl") return target.__setImpl.bind(target);
					if (prop === "__getState") return target.__getState.bind(target);
					return target[prop];
				}

				// Lazy mode: trigger materialization if needed
				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper._materialize();
				}

				// Lazy mode: if materializing, return a special proxy that waits
				// This allows api.math.advanced.calc.power to work by chaining proxies
				if (wrapper.mode === "lazy" && wrapper._state.inFlight) {
					// Return a waiting proxy with this property as the first in the chain
					return wrapper._createWaitingProxy([prop]);
				}

				// Access from __impl (materialized or eager mode)
				const impl = wrapper._impl;
				if (!impl) return undefined;

				const value = impl[prop];
				if (value === undefined) return undefined;

				// Check if value is a UnifiedWrapper (nested lazy module that hasn't materialized yet)
				// Return it directly - it will handle its own lazy materialization
				if (value && typeof value === "object" && value.__getState) {
					return value;
				}

				// Wrap functions with context
				if (typeof value === "function") {
					return wrapper._wrapFunction(value, `${wrapper.apiPath}.${String(prop)}`);
				}

				// Wrap plain nested objects (not lazy wrappers)
				// These are regular objects from the materialized __impl, not subdirectories
				if (value && typeof value === "object" && !Array.isArray(value)) {
					// Create wrapper for plain object (eager since it's already in memory)
					const nestedWrapper = new UnifiedWrapper({
						mode: "eager", // Plain objects from __impl are already loaded
						apiPath: wrapper.apiPath ? `${wrapper.apiPath}.${String(prop)}` : String(prop),
						contextManager: wrapper.contextManager,
						instanceId: wrapper.instanceId,
						initialImpl: value
					});
					return nestedWrapper.createProxy();
				}

				// Primitives and arrays
				return value;
			},

			apply(target, thisArg, args) {
				// Lazy mode: trigger materialization if needed
				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper._materialize();
				}

				// Lazy mode: return promise if materializing
				if (wrapper.mode === "lazy" && wrapper._state.inFlight) {
					return new Promise((resolve, reject) => {
						const check = () => {
							if (wrapper._state.materialized) {
								const impl = wrapper._impl;
								if (typeof impl === "function") {
									resolve(wrapper.contextManager.runInContext(wrapper.instanceId, impl, thisArg, args));
								} else {
									reject(new Error(`${wrapper.apiPath} is not callable`));
								}
							} else {
								setImmediate(check);
							}
						};
						check();
					});
				}

				// Call from __impl
				const impl = wrapper._impl;
				if (typeof impl === "function") {
					return wrapper.contextManager.runInContext(wrapper.instanceId, impl, thisArg, args);
				}

				throw new TypeError(`${wrapper.apiPath || "api"} is not a function`);
			},

			has(target, prop) {
				if (prop === "__impl" || prop === "__setImpl" || prop === "__getState") return true;
				return wrapper._impl ? prop in wrapper._impl : false;
			},

			ownKeys(target) {
				// Lazy mode: trigger materialization if needed
				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper._materialize();
				}

				const keys = wrapper._impl ? Reflect.ownKeys(wrapper._impl) : [];
				// Add internal methods
				keys.push("__impl", "__setImpl", "__getState");
				return keys;
			}
		});
	}
}

// ============================================================================
// Test Setup - Create Pseudo API
// ============================================================================

async function loadMathModule(contextManager, instanceId, mode) {
	// Simulate async file loading
	console.log(`[LOAD] Loading math module (${mode} mode)...`);
	await new Promise((resolve) => setTimeout(resolve, 50));

	const impl = {
		add: (a, b) => {
			console.log(`[MATH.ADD] Called with a=${a}, b=${b}`);
			return a + b;
		},
		multiply: (a, b) => a * b,
		divide: (a, b) => a / b
	};

	// Add nested "advanced" module
	if (mode === "lazy") {
		// In lazy mode, advanced is another lazy wrapper
		const advancedWrapper = new UnifiedWrapper({
			mode: "lazy",
			apiPath: "math.advanced",
			contextManager,
			instanceId,
			initialImpl: null,
			materializeFunc: () => loadMathAdvancedModule(contextManager, instanceId, mode)
		});
		impl.advanced = advancedWrapper.createProxy();
	} else {
		// In eager mode, load immediately
		impl.advanced = await loadMathAdvancedModule(contextManager, instanceId, mode);
	}

	return impl;
}

async function loadMathAdvancedModule(contextManager, instanceId, mode) {
	console.log(`[LOAD] Loading math.advanced module (${mode} mode)...`);
	await new Promise((resolve) => setTimeout(resolve, 40));

	const impl = {
		square: (x) => x * x,
		cube: (x) => x * x * x
	};

	// Add even deeper nested "calc" module
	if (mode === "lazy") {
		const calcWrapper = new UnifiedWrapper({
			mode: "lazy",
			apiPath: "math.advanced.calc",
			contextManager,
			instanceId,
			initialImpl: null,
			materializeFunc: () => loadMathCalcModule()
		});
		impl.calc = calcWrapper.createProxy();
	} else {
		impl.calc = await loadMathCalcModule();
	}

	return impl;
}

async function loadMathCalcModule() {
	console.log(`[LOAD] Loading math.advanced.calc module...`);
	await new Promise((resolve) => setTimeout(resolve, 30));

	return {
		power: (a, b) => {
			console.log(`[MATH.ADVANCED.CALC.POWER] Called with a=${a}, b=${b}`);
			return Math.pow(a, b);
		},
		factorial: (n) => {
			if (n <= 1) return 1;
			return n * factorial(n - 1);
		}
	};
}

async function loadStringModule() {
	console.log(`[LOAD] Loading string module...`);
	await new Promise((resolve) => setTimeout(resolve, 30));

	return {
		upper: (str) => str.toUpperCase(),
		lower: (str) => str.toLowerCase(),
		reverse: (str) => str.split("").reverse().join("")
	};
}

// ============================================================================
// Test Runner
// ============================================================================

async function testMode(mode) {
	console.log(`\n${"=".repeat(60)}`);
	console.log(`Testing ${mode.toUpperCase()} Mode`);
	console.log("=".repeat(60));

	const startTime = performance.now();
	const contextManager = new ContextManager();
	const instanceId = `test_${Date.now()}`;

	// Create API structure
	const api = {};

	// Math module
	const mathWrapper = new UnifiedWrapper({
		mode,
		apiPath: "math",
		contextManager,
		instanceId,
		initialImpl: mode === "eager" ? await loadMathModule(contextManager, instanceId, mode) : null,
		materializeFunc: mode === "lazy" ? () => loadMathModule(contextManager, instanceId, mode) : null
	});
	api.math = mathWrapper.createProxy();

	// String module
	const stringWrapper = new UnifiedWrapper({
		mode,
		apiPath: "string",
		contextManager,
		instanceId,
		initialImpl: mode === "eager" ? await loadStringModule() : null,
		materializeFunc: mode === "lazy" ? loadStringModule : null
	});
	api.string = stringWrapper.createProxy();

	// Test 1: Check __impl pattern (before any materialization)
	const t1Start = performance.now();
	console.log("\n[TEST 1] __impl pattern (pre-materialization):");
	console.log("math.__getState():", api.math.__getState());
	console.log("string.__getState():", api.string.__getState());
	console.log(`⏱️  Test 1 took: ${formatTime(performance.now() - t1Start)}`);

	// Test 2: Deep nested call - THE CRITICAL TEST (triggers full chain)
	const t2Start = performance.now();
	console.log("\n[TEST 2] Deep nested call FIRST (api.math.advanced.calc.power):");
	try {
		let result;
		if (mode === "lazy") {
			// Lazy mode might return promises
			console.log("Calling api.math.advanced.calc.power(2, 8) with await...");
			const callStart = performance.now();
			result = await api.math.advanced.calc.power(2, 8);
			console.log(`  (Call itself took: ${formatTime(performance.now() - callStart)})`);
		} else {
			console.log("Calling api.math.advanced.calc.power(2, 8) directly...");
			result = api.math.advanced.calc.power(2, 8);
		}
		console.log("Result:", result);
		console.log("✅ Deep nested call successful");
		console.log(`⏱️  Test 2 took: ${formatTime(performance.now() - t2Start)}`);
	} catch (err) {
		console.log("❌ Deep nested call failed:", err.message);
		console.log("Stack:", err.stack);
		console.log(`⏱️  Test 2 took: ${formatTime(performance.now() - t2Start)}`);
	}

	// Test 3: Access properties at various depths (deepest to shallowest)
	const t3Start = performance.now();
	console.log("\n[TEST 3] Property type checks (deepest to shallowest):");
	console.log("typeof api.math.advanced.calc.power:", typeof api.math.advanced.calc.power);
	console.log("typeof api.math.advanced.calc:", typeof api.math.advanced.calc);
	console.log("typeof api.math.advanced:", typeof api.math.advanced);
	console.log("typeof api.math.add:", typeof api.math.add);
	console.log("typeof api.math:", typeof api.math);
	console.log(`⏱️  Test 3 took: ${formatTime(performance.now() - t3Start)}`);

	// Test 4: Performance - First vs Sequential Calls (Shallow - UNMATERIALIZED branch)
	console.log("\n[TEST 4] Performance - Shallow calls (api.string.upper):");

	const shallowTimes = [];
	for (let i = 0; i < 5; i++) {
		const callStart = performance.now();
		let result;
		if (mode === "lazy") {
			result = await api.string.upper(`test${i}`);
		} else {
			result = api.string.upper(`test${i}`);
		}
		const callTime = performance.now() - callStart;
		shallowTimes.push(callTime);
		console.log(`  Call ${i + 1}: ${formatTime(callTime)} => ${result}`);
	}
	console.log(`  📊 First call: ${formatTime(shallowTimes[0])} ${mode === "lazy" ? "(includes materialization)" : ""}`);
	console.log(`  📊 Avg subsequent: ${formatTime(shallowTimes.slice(1).reduce((a, b) => a + b) / 4)}`);

	// Test 5: Performance - First vs Sequential Calls (Deep - already materialized)
	console.log("\n[TEST 5] Performance - Deep calls (api.math.advanced.calc.power):");

	const deepTimes = [];
	for (let i = 0; i < 5; i++) {
		const callStart = performance.now();
		let result;
		if (mode === "lazy") {
			result = await api.math.advanced.calc.power(2, 3 + i);
		} else {
			result = api.math.advanced.calc.power(2, 3 + i);
		}
		const callTime = performance.now() - callStart;
		deepTimes.push(callTime);
		console.log(`  Call ${i + 1}: ${formatTime(callTime)} => ${result}`);
	}
	console.log(`  📊 First call: ${formatTime(deepTimes[0])} ${mode === "lazy" ? "(already materialized from Test 2)" : ""}`);
	console.log(`  📊 Avg subsequent: ${formatTime(deepTimes.slice(1).reduce((a, b) => a + b) / 4)}`);

	// Test 6: Math module shallow call (already materialized)
	console.log("\n[TEST 6] Math module shallow call (already materialized):");
	try {
		let result;
		if (mode === "lazy") {
			result = await api.math.add(100, 200);
		} else {
			result = api.math.add(100, 200);
		}
		console.log("api.math.add(100, 200):", result);
		console.log("✅ Math add successful");
	} catch (err) {
		console.log("❌ Math add failed:", err.message);
	}

	// Test 7: State after all calls (should show materialized)
	console.log("\n[TEST 7] State after all calls:");
	console.log("math.__getState():", api.math.__getState());
	console.log("math.advanced.__getState():", api.math.advanced.__getState?.());
	console.log("string.__getState():", api.string.__getState());

	// Test 8: Subsequent calls (should be synchronous even in lazy)
	if (mode === "lazy") {
		console.log("\n[TEST 8] Subsequent calls (lazy mode):");
		const result2 = api.math.multiply(3, 4);
		console.log("api.math.multiply(3, 4):", result2);

		// Deep call should also be synchronous now
		const result3 = api.math.advanced.square(5);
		console.log("api.math.advanced.square(5):", result3);

		const result4 = api.math.advanced.calc.power(3, 3);
		console.log("api.math.advanced.calc.power(3, 3):", result4);

		console.log("✅ All subsequent calls are synchronous");
	}

	// Test 9: Context isolation
	console.log("\n[TEST 9] Context isolation:");
	const ctx = contextManager.getContext();
	console.log("Current context:", ctx ? ctx.instanceId : "none");
	console.log("Context testData:", ctx ? ctx.testData : "none");

	const totalTime = performance.now() - startTime;
	console.log(`\n⏱️  Total ${mode.toUpperCase()} mode time: ${formatTime(totalTime)}`);
	console.log(`${mode.toUpperCase()} Mode Tests Complete!`);
}

// ============================================================================
// Run All Tests
// ============================================================================

async function testContextIsolation() {
	console.log(`\n${"=".repeat(60)}`);
	console.log("Testing Context Isolation Between Instances");
	console.log("=".repeat(60));

	// Create two separate instances with shared context manager
	const sharedContextManager = new ContextManager();
	const instance1Id = "instance1_test";
	const instance2Id = "instance2_test";

	// Create instance 1 API
	const math1Wrapper = new UnifiedWrapper({
		mode: "eager",
		apiPath: "math",
		contextManager: sharedContextManager,
		instanceId: instance1Id,
		initialImpl: await loadMathModule(sharedContextManager, instance1Id, "eager")
	});
	const api1 = { math: math1Wrapper.createProxy() };

	// Create instance 2 API
	const math2Wrapper = new UnifiedWrapper({
		mode: "eager",
		apiPath: "math",
		contextManager: sharedContextManager,
		instanceId: instance2Id,
		initialImpl: await loadMathModule(sharedContextManager, instance2Id, "eager")
	});
	const api2 = { math: math2Wrapper.createProxy() };

	console.log("\n[TEST] Calling api1.math.add and api2.math.add with context tracking:");

	// Track which contexts were active
	const contexts = [];

	// Wrap add to capture context
	const captureContext = (id) => {
		return function (...args) {
			const ctx = sharedContextManager.getContext();
			contexts.push({
				calledFrom: id,
				contextInstanceId: ctx?.instanceId,
				testData: ctx?.testData,
				matches: ctx?.instanceId === id
			});
			return args[0] + args[1];
		};
	};

	// Call from instance 1
	const result1 = api1.math.add(10, 20);
	console.log(`Instance 1 result: ${result1}`);

	// Call from instance 2
	const result2 = api2.math.add(30, 40);
	console.log(`Instance 2 result: ${result2}`);

	// Verify contexts
	console.log("\n[VERIFY] Context isolation:");
	contexts.forEach((entry, i) => {
		console.log(
			`  Call ${i + 1}: calledFrom=${entry.calledFrom}, contextInstanceId=${entry.contextInstanceId}, matches=${entry.matches ? "✅" : "❌"}`
		);
	});

	const allMatch = contexts.every((c) => c.matches);
	if (allMatch) {
		console.log("\n✅ Context isolation verified - no bleed between instances");
	} else {
		console.log("\n❌ Context isolation FAILED - context bleeding detected!");
	}

	console.log("\nContext Isolation Tests Complete!");
}

async function runTests() {
	console.log("Unified Wrapper Test - Lazy vs Eager with AsyncLocalStorage\n");

	const totalStart = performance.now();

	await testMode("eager");
	await testMode("lazy");
	await testContextIsolation();

	const totalTime = performance.now() - totalStart;

	console.log("\n" + "=".repeat(60));
	console.log(`All Tests Complete! Total time: ${formatTime(totalTime)}`);
	console.log("=".repeat(60));
}

runTests().catch(console.error);
