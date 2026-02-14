import slothlet from './index.mjs';

console.log('\n=== Testing removal WITHOUT diagnostics ===');
const api1 = await slothlet({ dir: './api_tests/api_test_typescript', typescript: true, diagnostics: false });
console.log('Math exists:', !!api1.math);
const removed1 = await api1.slothlet.api.remove('math');
console.log('Removed:', removed1);
console.log('Math after removal:', api1.math);
await api1.slothlet.shutdown();

console.log('\n=== Testing removal WITH diagnostics ===');
const api2 = await slothlet({ dir: './api_tests/api_test_typescript', typescript: true, diagnostics: true });
console.log('Math exists:', !!api2.math);
const removed2 = await api2.slothlet.api.remove('math');
console.log('Removed:', removed2);
console.log('Math after removal:', api2.math);
await api2.slothlet.shutdown();
