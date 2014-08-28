
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var Q = require('q');

module.exports = function(connectUrl) {
	return new MongoEntityDao(connectUrl);
};


function MongoEntityDao(connectUrl) {
	var thisDao = this;
	this.dataCache = {};
	var deferred = Q.defer();

	console.log('Connecting to mongo using: ' + connectUrl);
	MongoClient.connect('mongodb://' + connectUrl, function(err, db) {
		if (err) {
			console.log('Failed to connected to mongo db: ' + err);
			deferred.reject(err);
			}
		else {
			console.log('Connected to mongo db');
			deferred.resolve(db);
		}
	});
	
	this.getDb = deferred.promise;
}

MongoEntityDao.prototype.getCollection = function(dkey) {
	return this.getDb.then(function(db){
		return db.collection('engage_' + dkey);
	});
}

MongoEntityDao.prototype.cacheKey = function(dkey, ekey) {
	return dkey + '/' + ekey;
}

MongoEntityDao.prototype.get = function(dkey, ekey) {
	var thisDao = this;
	var cacheKey = this.cacheKey(dkey, ekey);
	var data = this.dataCache[cacheKey];

	if (data)
		return Q(data);
	
	var keyPhrase =(/^\d/.test(ekey))
		? {'_id':ObjectID(ekey)} : {'entityKey':ekey};
	
	return this.getCollection(dkey).then(function(collection){
		var deferred = Q.defer();
		collection.findOne(keyPhrase, function(err, data){
			if (err) { return deferred.reject(err); }
			if (!data) { return deferred.reject('No data found for ' + dkey + '/' + ekey); }
			
			var cacheData = {};
			copyObj(cacheData, data);
			delete cacheData._id;
			thisDao.dataCache[cacheKey] = cacheData;
			
			deferred.resolve(cacheData);
		});
		return deferred.promise;
	});
}

MongoEntityDao.prototype.write= function(dkey, ekey, updatedVars) {
	var thisDao = this;
	var cacheKey = this.cacheKey(dkey, ekey);
	var data = thisDao.dataCache[cacheKey];

	if (!data) {
		return this.get(dkey, ekey).then(function(data) {
			return thisDao.write(dkey, ekey, updatedVars);
		});
	}
	copyObj(data, updatedVars);
	
	var keyPhrase =(/^\d/.test(ekey))
		? {'_id':ObjectID(ekey)} : {'entityKey':ekey};
	
	return this.getCollection(dkey).then(function(collection){
		var deferred = Q.defer();
		collection.update(keyPhrase, data, {upsert:true, w:0}, function(err, result) {
			if (err) { return deferred.reject(err); }
			deferred.resolve();
		});
		return deferred.promise;
	});
}

MongoEntityDao.prototype.create = function(dkey, data) {
	var thisDao = this;
	return this.getCollection(dkey).then(function(collection){
		var deferred = Q.defer();
		collection.insert(data, {w:1}, function(err, results){
			if (err) { return deferred.reject(err); }
			var ekey = results[0]._id.valueOf();
			
			var cacheKey = thisDao.cacheKey(dkey, ekey);
			var cacheData = {};
			copyObj(cacheData, data);
			delete cacheData._id;
			thisDao.dataCache[cacheKey] = cacheData;
			deferred.resolve(ekey);
		});
		return deferred.promise;
	});
}

MongoEntityDao.prototype.select = function(dkey, query, vars) {
	return errorPromise('Not Yet Implemented');
}

function copyObj(target, source) {
	for (var pname in source) {
		if (source.hasOwnProperty(pname))
			target[pname] = source[pname];
	}
	return target;
}

function errorPromise(msg) {
	return Q.fcall(function () { throw new Error(msg); });
}


