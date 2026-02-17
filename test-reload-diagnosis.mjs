#!/usr/bin/env node
/**
 * Comprehensive diagnostic for api.add behavior across matrix configs
 * Tests the INITIAL LOAD (before any reload) to establish baseline
 */

import slothlet from './index.mjs';

const TEST_DIRS = {
	API_TEST: "./api_tests/api_test"
};

const modes = ['EAGER', 'LAZY'];
const collisionModes = ['merge', 'replace'];

console.log('='.repeat(80));
console.log('INITIAL LOAD DIAGNOSTIC - MATCHING TEST SETUP');
console.log('Tests: Base API loaded + nested.comp1 added (same directory)');
console.log('='.repeat(80));

for (const mode of modes) {
	for (const collisionMode of collisionModes) {
		console.log(`\n${'='.repeat(80)}`);
		console.log(`MODE: ${mode} | COLLISION: ${collisionMode}`);
		console.log('='.repeat(80));
		
		try {
			// MATCH THE TEST EXACTLY - init with dir: API_TEST (autoloads base API)
			const api = await slothlet({
				mode,
				dir: TEST_DIRS.API_TEST,
				api: {
					collision: {
						initial: collisionMode,
						api: collisionMode
					},
					mutations: {
						add: true,
						remove: true,
						reload: true
					}
				},
				debug: mode === 'LAZY' && collisionMode === 'replace' ? ['api', 'modes', 'collision'] : []
			});

			console.log('\n1. BASE API (autoloaded from dir):');
			console.log(`   typeof api.math: ${typeof api.math}`);
			if (api.math?.add) {
				const baseResult = api.math.add(1, 1);
				console.log(`   api.math.add(1, 1) = ${baseResult}`);
				console.log(`   Source: ${baseResult === 2 ? 'math/ DIRECTORY' : baseResult === 1002 ? 'math.mjs FILE' : 'UNKNOWN'}`);
			}
			if (api.math?.collisionVersion) {
				console.log(`   collisionVersion: ${api.math.collisionVersion}`);
			}

			console.log('\n2. Add nested.comp1 (same directory):');
			await api.slothlet.api.add("nested.comp1", TEST_DIRS.API_TEST);
			
			console.log(`   typeof api.nested: ${typeof api.nested}`);
			console.log(`   typeof api.nested.comp1: ${typeof api.nested.comp1}`);
			
			// Check math BEFORE calling it
			console.log(`   typeof api.nested.comp1.math: ${typeof api.nested.comp1.math}`);
			console.log(`   api.nested.comp1.math.__apiPath: ${api.nested.comp1.math.__apiPath}`);
			console.log(`   api.nested.comp1.math.__mode: ${api.nested.comp1.math.__mode}`);
			const comp1MathState = api.nested.comp1.math.___getState?.();
			if (comp1MathState) {
				console.log(`   comp1.math state: materialized=${comp1MathState.materialized}, inFlight=${comp1MathState.inFlight}, collisionMode=${comp1MathState.collisionMode}`);
			}
			
			if (api.nested.comp1.math?.add) {
				const syncResult = api.nested.comp1.math.add(1, 1);
				const isPromise = syncResult && typeof syncResult === 'object' && typeof syncResult.then === 'function';
				console.log(`   api.nested.comp1.math.add(1, 1) = ${syncResult} ${isPromise ? '(PROMISE!)' : ''}`);
				
				if (isPromise) {
					const awaitedResult = await syncResult;
					console.log(`   awaited result = ${awaitedResult}`);
					console.log(`   Source: ${awaitedResult === 2 ? 'math/ DIRECTORY' : awaitedResult === 1002 ? 'math.mjs FILE' : 'UNKNOWN'}`);
					console.log(`   Expected: 1002 (math.mjs FILE) | Status: ${awaitedResult === 1002 ? '✅ CORRECT' : '❌ WRONG - got ' + awaitedResult}`);
				} else {
					console.log(`   Source: ${syncResult === 2 ? 'math/ DIRECTORY' : syncResult === 1002 ? 'math.mjs FILE' : 'UNKNOWN'}`);
					console.log(`   Expected: 1002 (math.mjs FILE) | Status: ${syncResult === 1002 ? '✅ CORRECT' : '❌ WRONG - got ' + syncResult}`);
				}
			} else {
				console.log(`   ❌ nested.comp1.math.add NOT FOUND`);
			}
			if (api.nested.comp1.math?.collisionVersion) {
				console.log(`   collisionVersion: ${api.nested.comp1.math.collisionVersion}`);
			}

			console.log('\n3. Add nested.comp2 (same directory again):');
			await api.slothlet.api.add("nested.comp2", TEST_DIRS.API_TEST);
			
			console.log(`   typeof api.nested.comp2: ${typeof api.nested.comp2}`);
			console.log(`   typeof api.nested.comp2.math: ${typeof api.nested.comp2.math}`);
			
			// Check comp2 math state
			console.log(`   api.nested.comp2.math.__apiPath: ${api.nested.comp2.math.__apiPath}`);
			console.log(`   api.nested.comp2.math.__mode: ${api.nested.comp2.math.__mode}`);
			const comp2MathState = api.nested.comp2.math.___getState?.();
			if (comp2MathState) {
				console.log(`   comp2.math state: materialized=${comp2MathState.materialized}, inFlight=${comp2MathState.inFlight}, collisionMode=${comp2MathState.collisionMode}`);
			}
			
			if (api.nested.comp2.math?.add) {
				const syncResult2 = api.nested.comp2.math.add(1, 1);
				const isPromise2 = syncResult2 && typeof syncResult2 === 'object' && typeof syncResult2.then === 'function';
				console.log(`   api.nested.comp2.math.add(1, 1) = ${syncResult2} ${isPromise2 ? '(PROMISE!)' : ''}`);
				
				if (isPromise2) {
					const awaitedResult2 = await syncResult2;
					console.log(`   awaited result = ${awaitedResult2}`);
					console.log(`   Source: ${awaitedResult2 === 2 ? 'math/ DIRECTORY' : awaitedResult2 === 1002 ? 'math.mjs FILE' : 'UNKNOWN'}`);
					console.log(`   Expected: 1002 (math.mjs FILE) | Status: ${awaitedResult2 === 1002 ? '✅ CORRECT' : '❌ WRONG - got ' + awaitedResult2}`);
				} else {
					console.log(`   Source: ${syncResult2 === 2 ? 'math/ DIRECTORY' : syncResult2 === 1002 ? 'math.mjs FILE' : 'UNKNOWN'}`);
					console.log(`   Expected: 1002 (math.mjs FILE) | Status: ${syncResult2 === 1002 ? '✅ CORRECT' : '❌ WRONG - got ' + syncResult2}`);
				}
			} else {
				console.log(`   ❌ nested.comp2.math.add NOT FOUND`);
			}
			if (api.nested.comp2.math?.collisionVersion) {
				console.log(`   collisionVersion: ${api.nested.comp2.math.collisionVersion}`);
			}

			console.log('\n4. Check if both use same math instance:');
			if (api.nested.comp1.math && api.nested.comp2.math) {
				const sameInstance = api.nested.comp1.math === api.nested.comp2.math;
				console.log(`   comp1.math === comp2.math: ${sameInstance}`);
			}

			console.log('\n5. Check math.collisionVersion:');
			if (api.nested.comp1.math?.collisionVersion) {
				console.log(`   comp1.math.collisionVersion: ${api.nested.comp1.math.collisionVersion}`);
			}
			if (api.nested.comp2.math?.collisionVersion) {
				console.log(`   comp2.math.collisionVersion: ${api.nested.comp2.math.collisionVersion}`);
			}

			await api.shutdown();
		} catch (error) {
			console.log(`\n❌ ERROR during test: ${error.message}`);
			console.log(error.stack);
			
			// Try to shutdown anyway
			try {
				if (typeof api !== 'undefined' && api.shutdown) {
					await api.shutdown();
				}
			} catch (shutdownError) {
				// Ignore shutdown errors
			}
		}
	}
}

console.log('\n' + '='.repeat(80));
console.log('DIAGNOSTIC COMPLETE');
console.log('='.repeat(80));


console.log(`   typeof api.nested: ${typeof api.nested}`);
console.log(`   typeof api.nested.comp1: ${typeof api.nested.comp1}`);
console.log(`   typeof api.nested.comp1.math: ${typeof api.nested.comp1.math}`);

if (api.nested.comp1.math?.add) {
	const result1 = api.nested.comp1.math.add(1, 1);
	console.log(`   api.nested.comp1.math.add(1, 1) = ${result1}`);
	console.log(`   Expected: 1002, Status: ${result1 === 1002 ? '✅' : '❌'}`);
} else {
	console.log(`   ❌ math.add not found`);
}

console.log('\n2. ADD SECOND COMPONENT - nested.comp2');
await api.slothlet.api.add("nested.comp2", TEST_DIRS.API_TEST);

console.log(`   typeof api.nested.comp2: ${typeof api.nested.comp2}`);
if (api.nested.comp2.math?.add) {
	const result2 = api.nested.comp2.math.add(1, 1);
	console.log(`   api.nested.comp2.math.add(1, 1) = ${result2}`);
	console.log(`   Expected: 1002, Status: ${result2 === 1002 ? '✅' : '❌'}`);
}

console.log('\n3. ADD CUSTOM PROPERTIES');
api.nested.comp1.customFlag = true;
api.nested.comp2.customData = { test: true };
api.nested.parentFlag = "parent-level";

console.log(`   api.nested.comp1.customFlag: ${api.nested.comp1.customFlag}`);
console.log(`   api.nested.comp2.customData: ${JSON.stringify(api.nested.comp2.customData)}`);
console.log(`   api.nested.parentFlag: ${api.nested.parentFlag}`);

console.log('\n4. BEFORE RELOAD - Verify math.add still works');
const beforeReload1 = api.nested.comp1.math.add(1, 1);
const beforeReload2 = api.nested.comp2.math.add(1, 1);
console.log(`   comp1.math.add(1, 1) = ${beforeReload1} (expected 1002) ${beforeReload1 === 1002 ? '✅' : '❌'}`);
console.log(`   comp2.math.add(1, 1) = ${beforeReload2} (expected 1002) ${beforeReload2 === 1002 ? '✅' : '❌'}`);

console.log('\n5. RELOAD PARENT PATH');
await api.slothlet.api.reload("nested");

console.log('\n6. AFTER RELOAD - Check types and values');
console.log(`   typeof api.nested: ${typeof api.nested}`);
console.log(`   typeof api.nested.comp1: ${typeof api.nested.comp1}`);
console.log(`   typeof api.nested.comp2: ${typeof api.nested.comp2}`);
console.log(`   typeof api.nested.comp1.math: ${typeof api.nested.comp1.math}`);

console.log('\n7. AFTER RELOAD - Verify math.add');
if (api.nested.comp1.math?.add) {
	const afterReload1 = api.nested.comp1.math.add(1, 1);
	console.log(`   comp1.math.add(1, 1) = ${afterReload1} (expected 1002) ${afterReload1 === 1002 ? '✅' : '❌ WRONG!'}`);
} else {
	console.log(`   ❌ comp1.math.add not found!`);
}

if (api.nested.comp2.math?.add) {
	const afterReload2 = api.nested.comp2.math.add(1, 1);
	console.log(`   comp2.math.add(1, 1) = ${afterReload2} (expected 1002) ${afterReload2 === 1002 ? '✅' : '❌ WRONG!'}`);
} else {
	console.log(`   ❌ comp2.math.add not found!`);
}

console.log('\n8. AFTER RELOAD - Check custom properties');
console.log(`   comp1.customFlag: ${api.nested.comp1.customFlag} (expected true)`);
console.log(`   comp2.customData: ${JSON.stringify(api.nested.comp2.customData)} (expected {test:true})`);
console.log(`   parentFlag: ${api.nested.parentFlag} (expected "parent-level")`);

console.log('\n9. DEBUG - Check what math module is loaded');
if (api.nested.comp1.math) {
	console.log(`   comp1.math keys: ${Object.keys(api.nested.comp1.math).join(', ')}`);
	if (api.nested.comp1.math.collisionVersion) {
		console.log(`   comp1.math.collisionVersion: ${api.nested.comp1.math.collisionVersion}`);
	}
}

await api.shutdown();

console.log('\n' + '='.repeat(80));
console.log('DIAGNOSIS COMPLETE');
console.log('='.repeat(80));
