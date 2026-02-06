**Last Evaluated:** 2026-02-06

Why is this even written like this... The children should live on the unified wrapper. What it should be is something like this: 

api: {
	math<unifiedWrapper> : entity<impl>: {
		add<unifiedWrapper> : entity<impl>,
		multiply<unifiedWrapper> : entity<impl>,
		subtract<unifiedWrapper> : entity<impl>,
	}
}

<impl> : {
	__type,
	__metadata: {
		owner,
		apiPath,
		etc,
		etc
	}
} Where each unified wrapper ONLY contains a wrapper function, that function returns it's information based on what is stored on the impl. The specific entity (object, function, primitve) is the impl and the metadata for that entity is stored in the impl wrapper. The unified wrapper should return data from the current impl if available or return data from itself if not available (don't see a use for the from self but just as a backup for now). Then any reference to the endpoint is a reference to a unified wrapper... changing what the endpoint is is as simple as changing out the impl. The unified wrapper SHOULD hold a history log of references to the impl. So backstepping an impl is super easy, just pop the last history then set the impl to a copy of last entry in the history array. when impl is replaced for whatever reason you ensure it's at the end of the history array then set impl to the new value. SUPER SIMPLE... you are making this beyond complicated... OWNERSHIP AND System metadata would be immutable so it could be trusted (to a degree we would need to make sure that you can't set impl outside of the normal routes and that impl could NOT have the reserved properties such as __type or __metadata during loading).