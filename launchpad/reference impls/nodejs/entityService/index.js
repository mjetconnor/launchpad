
var appLogic = require('./app-logic');
var marshaller = require('./marshaller');
var dao = require('./mongodb-dao')('localhost/launchpad');


var EKEY_DATASPACE = 'DATA';
var DKEY_SYSTEM = 'system';
var EKEY_SYSUSER = 'user-system';
var EKEY_SYSTENANT = 'system';


// ====================================================
//    mjAuthority class
// ====================================================

function mjAuthority(userId) {
	this.userId = userId;
}


// ====================================================
//    mjEntityService class
// ====================================================

function mjEntityService(userId) {
	this.ecache = {};
	if (userId)
		this.authority = new mjAuthority(userId);
}


var entityServiceCache = {};

mjEntityService.prototype.setGatewayURI = function(uri) {
	mjEntityService.prototype.gatewayURI = uri;
}

mjEntityService.prototype.makeEid = function(dkey, ekey) {
	ekey = ekey || EKEY_DATASPACE;
	return this.gatewayURI + '/' + dkey + '/' + ekey;
}

mjEntityService.prototype.getService = function(user) {
	if (user.isMjEntity) {
		user = user.eid;
	}

	var service = entityServiceCache[user];
	if (!service) {
		entityServiceCache[user] =
		service = new mjEntityService(user);
	}
	return service;
}

mjEntityService.prototype.get = function(eid) {
	var entity = this.ecache[eid];
	if (entity)
		return entity;
		
	entity = constructEntity(this, eid);
	return entity;
}

function constructEntity(esvc, eid) {
	var match = /^(.*)\/([^/]*)\/([^/]*)$/.exec(eid);
	if (!match)
		return fireOnLoads(entity, 'Illegal entity ID: ' + eid);
		
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
		entity = new DataSpaceEntity();
	else
		entity = new MindjetEntity();

	esvc.ecache[eid] = entity;
	entity.init(esvc, dkey, ekey);
	entity._onloads = [];
	
	dao.get(entity.dkey, entity.entityKey, function(err, data){
		if (err) {
			var errMsg = 'Cannot access entity for ' + entity.eid + ': ' + err;
			console.log(errMsg);
			fireOnLoads(entity, errMsg);
			return;
		}
		
		for (var pname in data) {
			if (data.hasOwnProperty(pname))
				marshaller.unmarshal(entity, data[pname], entity, pname) ;
		}
		
		fireOnLoads(entity, null);
	});
	
	return entity;
}

function fireOnLoads(entity, err) {
	while (entity._onloads && entity._onloads.length>0) {
		entity._onloads.pop() (err, entity);
	}
	delete entity._onloads;
}

mjEntityService.prototype.createDataSpace = function(dkey, tenant, done) { // done(err, dataSpace)
	var thisService = this;
	
	var data = {
		type: 'DataSpace',
		entityKey: EKEY_DATASPACE,
		created: new Date(),
		tenant: tenant
	};
	
	var marshalledData = marshaller.marshal(null, data);

	dao.create(dkey, marshalledData, function(err, newKey){
		if (err) return done(err);
		return done(null, thisService.get(thisService.makeEid(dkey, EKEY_DATASPACE)));
	});
}


// ====================================================
//    MindjetEntity class
// ====================================================

function MindjetEntity() { };

MindjetEntity.prototype.init = function(esvc, dkey, ekey, initialProps) {
	this.isMjEntity = true;
	this.entityService = esvc;
	this.dkey = dkey;
	this.entityKey = ekey;
	
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

MindjetEntity.prototype.post = function(args, done) { // done(err, result)
	if (!this.type)
		return done('POST to an entity that has no type');
	if (!args.type)
		return done('POST request is missing "type" property');
		
	var poster = appLogic.getPoster(this.type, args.type);
	if (!poster)
		return done('No POST supported for type ' + args.type + ' to type ' + this.type);
		
	poster(this, args, done);
}

MindjetEntity.prototype.put = function(args, done) {
	if (!this.type)
		return done('PUT to an entity that has no type');
		
	var putter = appLogic.getPutter(this.type);
	if (!putter)
		return done('No PUT supported for ' + this.type);
		
	putter(this, args, done);
}


MindjetEntity.prototype.matches = function(other) {
	if (!other.isMjEntity)
		return false;
	return (this.eid == other.eid);
}

MindjetEntity.prototype.update = function(vars, done) { // done(err, entity)
	var thisEntity = this;
	copyObj(thisEntity, vars);
	
	var dataForDB = marshaller.marshal(this.dataSpace, vars);	
	dao.write(this.dkey, this.entityKey, dataForDB, function(err){
		if (done) {
			if (err) return done(err);
			return done(null, thisEntity);
		}
	});
}

MindjetEntity.prototype.onLoad = function(done) { // done(err, entity)
	if (!this._onloads)
		return done(null, this);
	else
		this._onloads.push(done);
}


// ====================================================
//    DataSpace class
// ====================================================

function DataSpaceEntity() { }
DataSpaceEntity.prototype = new MindjetEntity();

DataSpaceEntity.prototype.create = function(vars, done) { // done(err, newEntity)
	var thisSpace = this;
	if (!vars.type)
		return done('missing type on entity create request');
	
	var extendedData = {};
	copyObj(extendedData, vars);
	extendedData.created = new Date();
	
	extendedData.creator = (this.entityService.authority) 
		? this.entityService.get(this.entityService.authority.userId)
		: this.entityService.systemUser;
	
	var marshalledData = marshaller.marshal(thisSpace, extendedData);

	dao.create(this.dkey, marshalledData, function(err, newKey){
		if (err) return done(err);
		if (marshalledData.entityKey)
			newKey = marshalledData.entityKey;
		return done(null, thisSpace.entityService.get(thisSpace.makeEid(newKey)));
	});
}

DataSpaceEntity.prototype.makeEid = function(ekey) {
	return this.entityService.makeEid(this.dkey, ekey);
}

DataSpaceEntity.prototype.select = function(query, vars, done) { // done(err, entityArray)
	var thisSpace = this;
	dao.select(this.dkey, query, vars, function(err, eids){
		if (err) return done(err);
		var entities = [];
		for (var i=0; i<eids.length; i++) {
			entities.push(thisSpace.entityService.get(eids[i]));
		}
		return done(null, entities);
	});
}

DataSpaceEntity.prototype.selectOne = function(query, vars, done) { // done(err, entity)
	var thisSpace = this;
	dao.select(this.dkey, query, vars,
		function(err, eids){
			if (err) return done(err);
			if (!eids || eids.length<1) return done(null, null);
			return done(thisSpace.entityService.get(elist[0]));
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


// ====================================================
//    EXPORT
// ====================================================

var systemService = mjEntityService.prototype.systemEntityService = new mjEntityService();
module.exports = systemService;

mjEntityService.prototype.systemTenant = new MindjetEntity()
	.init(systemService, DKEY_SYSTEM, EKEY_SYSTENANT, {
		type: 'Tenant',
		title: 'SYSTEM',
		description: 'The Engage System',
		img: {type:'Image', url:'http://engage.mindjet.com/img/system.png'}
	});

mjEntityService.prototype.systemUser = new MindjetEntity()
	.init(systemService, DKEY_SYSTEM, EKEY_SYSUSER, {
		type: 'User',
		name: 'Mr. Engage',
		givenName: 'Mr.',
		familyName: 'Engage',
		mbox: 'support@mindjet.com',
		img: {type:'Image', url:'http://engage.mindjet.com/img/system.png'}
	});

mjEntityService.prototype.systemSpace = new DataSpaceEntity()
	.init(systemService, DKEY_SYSTEM, EKEY_DATASPACE, {
		type: 'DataSpace',
		tenant: systemService.systemTenant
	});


