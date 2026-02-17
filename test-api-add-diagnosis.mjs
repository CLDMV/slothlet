#!/usr/bin/env node
/**
 * Diagnostic test for api.add behavior with callable namespaces
 * Tests: file vs folder processing order, collision modes, lazy vs eager
 */

import slothlet from './index.mjs';

const modes = ['EAGER', 'LAZY'];
const collisionModes = ['error', 'merge', 'replace'];

console.log('='.repeat(80));
console.log('API.ADD CALLABLE NAMESPACE DIAGNOSTIC');
console.log('='.repeat(80));

for (const mode of modes) {
	for (const collisionMode of collisionModes) {
		console.log(`\n${'='.repeat(80)}`);
		console.log(`MODE: ${mode} | COLLISION: ${collisionMode}`);
		console.log('='.repeat(80));
		
		try {
			const api = await slothlet({
				autoStart: false,
				dir: './api_tests/api_test',
				mode,
				collisionMode
			});
			
			// Test 1: Load API_TEST to a namespace
			await api.slothlet.api.add('testNS', './api_tests/api_test', { collisionMode });
			
			console.log('\n1. NAMESPACE TYPE:');
			console.log(`   typeof api.testNS: ${typeof api.testNS}`);
			
			console.log('\n2. NAMESPACE KEYS (first 10):');
			const keys = Object.keys(api.testNS).sort();
			console.log(`   ${keys.slice(0, 10).join(', ')}`);
			console.log(`   Total keys: ${keys.length}`);
			
			console.log('\n3. MATH MODULE:');
			console.log(`   typeof api.testNS.math: ${typeof api.testNS.math}`);
			if (api.testNS.math?.add) {
				const result = api.testNS.math.add(1, 1);
				console.log(`   api.testNS.math.add(1, 1) = ${result}`);
				console.log(`   Expected: 1002 (API_TEST version), Got: ${result}`);
				console.log(`   Status: ${result === 1002 ? '✅ CORRECT' : '❌ WRONG'}`);
			} else {
				console.log(`   ❌ math.add not found`);
			}
			
			console.log('\n4. ROOT FUNCTION:');
			if (typeof api.testNS === 'function') {
				try {
					const funcResult = api.testNS('test');
					console.log(`   ✅ api.testNS is callable`);
					console.log(`   api.testNS('test') = ${funcResult}`);
					console.log(`   Has rootFunctionShout: ${typeof api.testNS.rootFunctionShout}`);
					console.log(`   Has rootFunctionWhisper: ${typeof api.testNS.rootFunctionWhisper}`);
				} catch (e) {
					console.log(`   ❌ Error calling: ${e.message}`);
				}
			} else {
				console.log(`   ⚠️  api.testNS is not callable (type: ${typeof api.testNS})`);
			}
			
			// Test 2: Nested path
			console.log('\n5. NESTED PATH TEST:');
			await api.slothlet.api.add('nested.comp1', './api_tests/api_test', { collisionMode });
			console.log(`   typeof api.nested: ${typeof api.nested}`);
			console.log(`   typeof api.nested.comp1: ${typeof api.nested.comp1}`);
			if (api.nested.comp1?.math?.add) {
				const nestedResult = api.nested.comp1.math.add(1, 1);
				console.log(`   api.nested.comp1.math.add(1, 1) = ${nestedResult}`);
				console.log(`   Status: ${nestedResult === 1002 ? '✅ CORRECT' : '❌ WRONG'}`);
			} else {
				console.log(`   ❌ nested.comp1.math.add not found`);
			}
			
			await api.shutdown();
		} catch (error) {
			console.log(`\n❌ ERROR: ${error.message}`);
			console.log(error.stack);
		}
	}
}

console.log('\n' + '='.repeat(80));
console.log('DIAGNOSTIC COMPLETE');
console.log('='.repeat(80));
