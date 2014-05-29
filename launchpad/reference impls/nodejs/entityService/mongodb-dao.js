
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

module.exports = function(connectUrl) {
	return new MongoEntityDao(connectUrl);
};


function MongoEntityDao(connectUrl) {
	var thisDao = this;
	this.dataCache = {};
	this.waitingForDb = [];
	this.db;
	
	console.log('Connecting to mongo using: ' + connectUrl);
	MongoClient.connect('mongodb://' + connectUrl, function(err, db) {
		if (err) { return console.log(err); }
		
		thisDao.db = db;
		for (var i=0; i<thisDao.waitingForDb.length; i++) {
			thisDao.waitingForDb[i](null, db);
		}
	});
}

MongoEntityDao.prototype.getDb = function(done) { // done(err, db)
	if (this.db)
		return done(null, this.db);
	else {
		this.waitingForDb.push(done);
	}
}

MongoEntityDao.prototype.getCollection = function(dkey, done) { // done(err, collection)
	this.getDb(function(err, db){
		if (err) { return done(err); }
		var collection = db.collection('engage_' + dkey);
		done(null, collection);
	});
}

MongoEntityDao.prototype.cacheKey = function(dkey, ekey) {
	return dkey + '/' + ekey;
}

MongoEntityDao.prototype.get = function(dkey, ekey, done) { // done(err, data)
	var thisDao = this;
	var cacheKey = this.cacheKey(dkey, ekey);
	var data = this.dataCache[cacheKey];
	
	if (data)
		return done(null, data);
	
	var keyPhrase =(/^\d/.test(ekey))
		? {'_id':ObjectID(ekey)} : {'entityKey':ekey};
	
	this.getCollection(dkey, function(err, collection){
		if (err) { return done(err); }
		collection.findOne(keyPhrase, function(err, data){
			if (err) { return done(err); }
			if (!data) { return done('No data found for ' + dkey + '/' + ekey); }
			
			var cacheData = {};
			copyObj(cacheData, data);
			delete cacheData._id;
			thisDao.dataCache[cacheKey] = cacheData;
			
			done(null, cacheData);
		});
	});
}

MongoEntityDao.prototype.write= function(dkey, ekey, updatedVars, done) { // done(err)
	var thisDao = this;
	var cacheKey = this.cacheKey(dkey, ekey);
	var data = thisDao.dataCache[cacheKey];
	if (!data) {
		this.get(dkey, ekey, function(err, data) {
			thisDao.write(dkey, ekey, updatedVars, done);
		});
		return;
	}
	copyObj(data, updatedVars);
	
	var keyPhrase =(/^\d/.test(ekey))
		? {'_id':ObjectID(ekey)} : {'entityKey':ekey};
	
	this.getCollection(dkey, function(err, collection){
		if (err) { return done(err); }
		collection.update(keyPhrase, data, {upsert:true, w:0}, function(err, result) {
			done(err);
		});
	});
}

MongoEntityDao.prototype.create = function(dkey, data, done) { // done(err, newKey)
	var thisDao = this;
	this.getCollection(dkey, function(err, collection){
		if (err) { return done(err); }
		collection.insert(data, {w:1}, function(err, results){
			if (err) return done(err);
			var ekey = results[0]._id.valueOf();
			
			var cacheKey = thisDao.cacheKey(dkey, ekey);
			var cacheData = {};
			copyObj(cacheData, data);
			delete cacheData._id;
			thisDao.dataCache[cacheKey] = cacheData;
			done(null, ekey);
		});
	});
}

MongoEntityDao.prototype.select = function(dkey, query, vars, done) { // done(err, eidArray)
	done('Not Yet Implemented');
}

function copyObj(target, source) {
	for (var pname in source) {
		if (source.hasOwnProperty(pname))
			target[pname] = source[pname];
	}
	return target;
}

