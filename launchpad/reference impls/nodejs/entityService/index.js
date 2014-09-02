
var appLogic = require('./app-logic');
var marshaller = require('./marshaller');
var dao = require('./mongodb-dao')('localhost/launchpad');
var MjClass = require('./mjclass').MjClass;
var MjArray = require('./mjarray').MjArray;
var Q = require('q');


var EKEY_DATASPACE = 'DATA';
var DKEY_SYSTEM = 'system';
var EKEY_SYSUSER = 'user-system';
var EKEY_SYSTENANT = 'system';


// ====================================================
//    MjAuthority class
// ====================================================

function MjAuthority(userId) {
	this.userId = userId;
}


// ====================================================
//    MjEntityService class
// ====================================================

function MjEntityService(userId) {
	this.ecache = {};
	if (userId)
		this.authority = new MjAuthority(userId);
}

var entityServiceCache = {};
MjEntityService.prototype.MjEntity = MjEntity;
MjEntityService.prototype.MjAuthority = MjAuthority;
MjEntityService.prototype.MjClass = MjClass;
MjEntityService.prototype.MjArray = MjArray;


MjEntityService.prototype.setGatewayURI = function(uri) {
	MjEntityService.prototype.gatewayURI = uri;
	entityServiceCache = {};  // make sure there are no old cached entries

	var systemService = MjEntityService.prototype.systemEntityService;
	
	MjEntityService.prototype.systemTenant = systemService
		.get(systemService.makeEid(DKEY_SYSTEM, EKEY_SYSTENANT))
		.injectData({
			type: MjClass.get('Tenant'),
			title: 'SYSTEM',
			description: 'The Engage System',
			img: {type:'Image', url:'http://engage.mindjet.com/img/system.png'}
		});

	MjEntityService.prototype.systemUser = systemService
		.get(systemService.makeEid(DKEY_SYSTEM, EKEY_SYSUSER))
		.injectData({
			type: MjClass.get('User'),
			name: 'Mr. Engage',
			givenName: 'Mr.',
			familyName: 'Engage',
			mbox: 'support@mindjet.com',
			img: {type:'Image', url:'http://engage.mindjet.com/img/system.png'}
		});

	MjEntityService.prototype.systemSpace = systemService
		.get(systemService.makeEid(DKEY_SYSTEM, EKEY_DATASPACE))
		.injectData({
			type: MjClass.get('DataSpace'),
			tenant: systemService.systemTenant
		});
}

MjEntityService.prototype.makeEid = function(dkey, ekey) {
	ekey = ekey || EKEY_DATASPACE;
	return this.gatewayURI + '/' + dkey + '/' + ekey;
}

MjEntityService.prototype.getClass = function(typeName) {
	return MjClass.get(typeName);
}

MjEntityService.prototype.getService = function(user) {
	if (user.isMjEntity) {
		user = user.eid;
	}

	var service = entityServiceCache[user];
	if (!service) {
		entityServiceCache[user] =
		service = new MjEntityService(user);
	}
	return service;
}

MjEntityService.prototype.get = function(eid) {
	var entity = this.ecache[eid];
	if (entity)
		return entity;
		
	return new MjEntity(this, eid);
}

MjEntityService.prototype.createDataSpace = function(dkey, tenant) {
	var thisService = this;
	
	var data = {
		type: 'DataSpace',
		entityKey: EKEY_DATASPACE,
		created: new Date(),
		tenant: tenant
	};
	
	var marshalledData = marshaller.marshal(null, data);

	return dao.create(dkey, marshalledData)
	.then(function(newKey){
		return thisService.get(thisService.makeEid(dkey, EKEY_DATASPACE));
	});
}


// ====================================================
//    MjEntity class
// ====================================================

function MjEntity(esvc, eid) {
	this.isMjEntity = true;
	this.entityService = esvc;
	this.eid = eid;
	esvc.ecache[this.eid] = this;

	var match = /^(.*)\/([^/]*)\/([^/]*)$/.exec(eid);
	if (match) {		
		this.gatewayURI = match[1];
		this.dkey = match[2];
		this.entityKey = match[3];
	}

	if (this.entityKey == EKEY_DATASPACE) {
		this.dataSpace = this;
		this.type = MjClass.get('DataSpace');
	}
	else
		this.dataSpace = esvc.get(esvc.makeEid(this.dkey, EKEY_DATASPACE));
}

MjEntity.prototype.injectData = function(initialProps) {
	copyObj(this, initialProps);
	this._deferred = Q.defer();
	this._deferred.resolve(this);
	return this;
}

MjEntity.prototype.makeEid = function(ekey) {
	return this.gatewayURI + '/' + this.dkey + '/' + ekey;
}

MjEntity.prototype.isa = function(cl) {
	return this.type.isa(cl);
}

MjEntity.prototype.post = function(args) {
	var poster = appLogic.getPoster(this.type, args);
	return poster(this, args);
}

MjEntity.prototype.put = function(args) {
	var putter = appLogic.getPutter(this.type);
	if (!putter)
		return errorPromise('No PUT supported for ' + this.type);
		
	return putter(this, args);
}

MjEntity.prototype.matches = function(other) {
	if (!other.isMjEntity)
		return false;
	return (this.eid == other.eid);
}

MjEntity.prototype.set = function(vars) {
	var thisEntity = this;
	return this.load().then(function(){
		copyObj(thisEntity, vars);
		
		var dataForDB = marshaller.marshal(thisEntity.dataSpace, vars);	
		return dao.write(thisEntity.dkey, thisEntity.entityKey, dataForDB)
		.then(function(){
			return thisEntity;
		});
	});
}

MjEntity.prototype.add = function(vars) {
	var thisEntity = this;
	return this.load().then(function(){
		var setData = {};
		for (var pname in vars) {
			if (vars.hasOwnProperty(pname)) {
				var ary = thisEntity[pname];
				if (!ary)
					ary = new MjArray();
				ary.push(vars[pname]);
				setData[pname] = ary;
			}
		}
		return thisEntity.set(setData);
	});
}

MjEntity.prototype.load = function() {
	var thisEntity = this;
	if (!this._deferred) {
		this._deferred = Q.defer();

		dao.get(this.dkey, this.entityKey)
		.then(function(data){
			for (var pname in data) {
				if (data.hasOwnProperty(pname))
					marshaller.unmarshal(thisEntity, data[pname], thisEntity, pname) ;
			}
			
			thisEntity.type = MjClass.get(thisEntity.type);
			thisEntity._deferred.resolve(thisEntity);

		})
		.catch(function(err){
			var errMsg = 'Cannot access entity for ' + thisEntity.eid + ': ' + err;
			console.log(errMsg);
			thisEntity._deferred.reject(errMsg);
		})
		.done();
	}

	return this._deferred.promise;
}

MjEntity.prototype.create = function(vars) {
	var thisEntity = this;
	if (!vars.type)
		return errorPromise('missing type on entity create request');

	var extendedData = {};
	copyObj(extendedData, vars);
	extendedData.created = new Date();
	
	extendedData.creator = (this.entityService.authority) 
		? this.entityService.get(this.entityService.authority.userId)
		: this.entityService.systemUser;
	
	var marshalledData = marshaller.marshal(thisEntity, extendedData);

	return dao.create(this.dkey, marshalledData)
	.then(function(newKey){
		if (marshalledData.entityKey)
			newKey = marshalledData.entityKey;
		return thisEntity.entityService.get(
			thisEntity.entityService.makeEid(thisEntity.dkey, newKey));
	});
}

MjEntity.prototype.select = function(query, vars) {
	var thisEntity = this;
	return dao.select(this.dkey, query, vars)
	.then(function(eids){
		return eids.map(function(eid){ return thisEntity.entityService.get(eids[i]) });
	});
}

MjEntity.prototype.selectOne = function(query, vars) {
	var thisEntity = this;
	return dao.select(this.dkey, query, vars)
	.then(function(eids){
		if (!eids || eids.length<1)
			return null;
		return thisEntity.entityService.get(elist[0]);
	});
}


// ====================================================
//    utilities
// ====================================================

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


// ====================================================
//    EXPORT
// ====================================================

// The system entity service is the one that has a null userID
module.exports = MjEntityService.prototype.systemEntityService = new MjEntityService();

