/**
 * Manual test for TypeScript strict mode
 */
import slothlet from './index.mjs';

console.log('\n=== Testing TypeScript Strict Mode ===\n');

try {
	console.log('Test 1: Loading clean TypeScript files in strict mode...');
	const api1 = await slothlet({
		dir: './api_tests/api_test_typescript',
		typescript: {
			mode: 'strict',
			strict: true
		}
	});
	
	console.log('✅ Clean files loaded successfully');
	console.log('Math.add(5, 3) =', api1.math.add(5, 3));
	console.log('String.capitalize("hello") =', api1.string.capitalize("hello"));
	
	await api1.slothlet.shutdown();
	console.log('✅ Test 1 passed\n');
} catch (error) {
	console.error('❌ Test 1 failed:', error.message);
	console.error(error);
}

try {
	console.log('Test 2: Loading TypeScript files with type errors (should fail)...');
	const api2 = await slothlet({
		dir: './api_tests/api_test_typescript_errors',
		typescript: {
			mode: 'strict',
			strict: true
		}
	});
	
	// This should not be reached if typeError.ts is loaded
	console.error('❌ Test 2 failed: Expected type errors but loaded successfully');
	await api2.slothlet.shutdown();
} catch (error) {
	if (error.message.includes('Type ') || error.message.includes('type error')) {
		console.log('✅ Test 2 passed: Type errors detected correctly');
		console.log('Error message preview:', error.message.substring(0, 200) + '...');
	} else {
		console.error('❌ Test 2 failed with unexpected error:', error.message);
		console.error(error);
	}
}

console.log('\n=== Tests Complete ===');
