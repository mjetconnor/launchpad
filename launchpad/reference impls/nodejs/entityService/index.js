
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

MjEntityService.prototype.setGatewayURI = function(uri) {
	MjEntityService.prototype.gatewayURI = uri;
}

MjEntityService.prototype.makeEid = function(dkey, ekey) {
	ekey = ekey || EKEY_DATASPACE;
	return this.gatewayURI + '/' + dkey + '/' + ekey;
}

MjEntityService.prototype.MjEntity = MjEntity;
MjEntityService.prototype.MjAuthority = MjAuthority;
MjEntityService.prototype.MjClass = MjClass;
MjEntityService.prototype.MjArray = MjArray;

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
		
	entity = constructEntity(this, eid);
	return entity;
}

function constructEntity(esvc, eid) {
	var match = /^(.*)\/([^/]*)\/([^/]*)$/.exec(eid);
	if (!match)
		return null;
		
	var gatewayURI = match[1];
	var dkey = match[2];
	var ekey = match[3];

	if (dkey == DKEY_SYSTEM) {
		switch (ekey) {
			case EKEY_DATASPACE:  return esvc.systemSpace;
			case EKEY_SYSTENANT:  return esvc.systemTenant;
			case EKEY_SYSUSER:    return esvc.systemUser;
			default: break;
		}
	}

	var entity;
	if (ekey == EKEY_DATASPACE)
		entity = new MjDataSpace();
	else
		entity = new MjEntity();

	esvc.ecache[eid] = entity;
	entity.init(esvc, dkey, ekey);
	
	dao.get(entity.dkey, entity.entityKey)
	.then(function(data){
		for (var pname in data) {
			if (data.hasOwnProperty(pname))
				marshaller.unmarshal(entity, data[pname], entity, pname) ;
		}
		
		entity.type = MjClass.get(entity.type);
		entity._markLoaded();
	})
	.catch(function(err){
		var errMsg = 'Cannot access entity for ' + entity.eid + ': ' + err;
		console.log(errMsg);
		entity._deferred.reject(errMsg);
	})
	.done();
	
	return entity;
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

function MjEntity() { };

MjEntity.prototype.init = function(esvc, dkey, ekey, initialProps) {
	this.isMjEntity = true;
	this.entityService = esvc;
	this.dkey = dkey;
	this.entityKey = ekey;
	this._deferred = Q.defer();

	this.__defineGetter__('gatewayURI', function() {
		return esvc.gatewayURI;
	});
	
	this.__defineGetter__('eid', function() {
		return esvc.gatewayURI + '/' + dkey + '/' + ekey;
	});

	this.__defineGetter__('dataSpace', function() {
		if (ekey == EKEY_DATASPACE)
			return this;
		else
			return esvc.get(esvc.makeEid(dkey, EKEY_DATASPACE));
	});

	if (initialProps) {
		copyObj(this, initialProps);
	}
	
	return this;
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
	return this._deferred.promise;
}

MjEntity.prototype.create = function(vars) {
	return this.dataSpace.create(vars);
}

MjEntity.prototype._markLoaded = function() {
	this._deferred.resolve(this);
	return this;
}


// ====================================================
//    DataSpace class
// ====================================================

function MjDataSpace() { }
MjDataSpace.prototype = new MjEntity();

MjDataSpace.prototype.create = function(vars) {
	var thisSpace = this;
	if (!vars.type)
		return errorPromise('missing type on entity create request');

	var extendedData = {};
	copyObj(extendedData, vars);
	extendedData.created = new Date();
	
	extendedData.creator = (this.entityService.authority) 
		? this.entityService.get(this.entityService.authority.userId)
		: this.entityService.systemUser;
	
	var marshalledData = marshaller.marshal(thisSpace, extendedData);

	return dao.create(this.dkey, marshalledData)
	.then(function(newKey){
		if (marshalledData.entityKey)
			newKey = marshalledData.entityKey;
		return thisSpace.entityService.get(thisSpace.makeEid(newKey));
	});
}

MjDataSpace.prototype.makeEid = function(ekey) {
	return this.entityService.makeEid(this.dkey, ekey);
}

MjDataSpace.prototype.select = function(query, vars) {
	var thisSpace = this;
	return dao.select(this.dkey, query, vars)
	.then(function(eids){
		return eids.map(function(eid){ return thisSpace.entityService.get(eids[i]) });
	});
}

MjDataSpace.prototype.selectOne = function(query, vars) {
	var thisSpace = this;
	return dao.select(this.dkey, query, vars)
	.then(function(eids){
		if (!eids || eids.length<1)
			return null;
		return thisSpace.entityService.get(elist[0]);
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

var systemService = MjEntityService.prototype.systemEntityService = new MjEntityService();
module.exports = systemService;

MjEntityService.prototype.systemTenant = new MjEntity()
	.init(systemService, DKEY_SYSTEM, EKEY_SYSTENANT, {
		type: systemService.getClass('Tenant'),
		title: 'SYSTEM',
		description: 'The Engage System',
		img: {type:'Image', url:'http://engage.mindjet.com/img/system.png'}
	})._markLoaded();

MjEntityService.prototype.systemUser = new MjEntity()
	.init(systemService, DKEY_SYSTEM, EKEY_SYSUSER, {
		type: systemService.getClass('User'),
		name: 'Mr. Engage',
		givenName: 'Mr.',
		familyName: 'Engage',
		mbox: 'support@mindjet.com',
		img: {type:'Image', url:'http://engage.mindjet.com/img/system.png'}
	})._markLoaded();

MjEntityService.prototype.systemSpace = new MjDataSpace()
	.init(systemService, DKEY_SYSTEM, EKEY_DATASPACE, {
		type: systemService.getClass('DataSpace'),
		tenant: systemService.systemTenant
	})._markLoaded();


