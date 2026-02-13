import slothlet from './src/slothlet.mjs';

const api = await slothlet({ dir: './api_tests/api_test', mode: 'eager' });

console.log('\n=== Checking api object ===');
console.log('api.__wrapper:', typeof api.__wrapper);
console.log('api has slothlet:', 'slothlet' in api);

if (api.__wrapper) {
	const wrapper = api.__wrapper;
	console.log('\n=== Wrapper details ===');
	console.log('wrapper has slothlet:', 'slothlet' in wrapper);
	console.log('wrapper.slothlet (ComponentBase):', typeof wrapper.slothlet);
	console.log('wrapper.____slothletInternal.impl:', typeof wrapper.____slothletInternal.impl);
	
	if (wrapper.____slothletInternal.impl) {
		console.log('impl has slothlet:', 'slothlet' in wrapper.____slothletInternal.impl);
		console.log('impl.slothlet:', typeof wrapper.____slothletInternal.impl.slothlet);
	}
	
	console.log('\n=== Descriptors ===');
	console.log('wrapper slothlet descriptor:', Object.getOwnPropertyDescriptor(wrapper, 'slothlet'));
	if (wrapper.____slothletInternal.impl) {
		console.log('impl slothlet descriptor:', Object.getOwnPropertyDescriptor(wrapper.____slothletInternal.impl, 'slothlet'));
	}
}

console.log('\n=== Trying Object.keys ===');
try {
	const keys = Object.keys(api);
	console.log('Success! Keys:', keys.slice(0, 5));
} catch (err) {
	console.log('Error:', err.message);
}

await api.slothlet.shutdown();
