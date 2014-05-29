
module.exports = {
	get: getData,
	select: selectData
	create: createData,
	write: writeData
}

var entityDataCache = {};

function getData(dkey, ekey) {
	var cacheKey = dkey + '/' + ekey;
	var data = entityDataCache[cacheKey];
	if (!data) {
		data = readData(dkey, ekey);
		entityDataCache[cacheKey] = data;
	}
	return data;
}

function readData(dkey, ekey) {
	... read data from {dkey} catalog for {ekey} id ...
}

function writeData(dkey, ekey, vars, done) { // done(err)
	// TODO
	
	done(null);
}

function createData(dkey, vars, done) { // done(err, newKey)
	// TODO
}

function selectData(dkey, query, vars, done) { // done(err, eidArray)
	// TODO
}
