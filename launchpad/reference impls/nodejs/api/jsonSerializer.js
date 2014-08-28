
var entityService = require('../entityService');
var Q = require('q');

module.exports = {
	toJson: toJson,
	toEntity: toEntity
}

function toJson(value, level) {
	level = level || 0;
	
	switch (typeof value) {
	case 'function':
		return Q();
		
	case 'object':
		if (value instanceof Date) {
			return Q(value.toISOString());
		}
		else if (value instanceof Array) {
			var serialized = [];
			for (var i=0; i<value.length; i++) {
				serialized.push(toJson(value[i], level+1));
			}
			
			return Q.all(serialized).then(function(jsonedArray){
				return {data:jsonedArray}
			});
		}
		else if (value instanceof entityService.MjClass) {
			return Q(value.name);
		}
		else if (value.isMjEntity && level>0) {
			return value.load('type').then(function(){
				var typeStr = (value.type) ? value.type.name : 'NOCLASS';
				return {eid:value.eid, type:typeStr};
			});
		}
		else {
			var objJson = {};
			var promises = [];
			for (var pname in value) {
				if (/^_/.test(pname))
					continue;
				if (!value.hasOwnProperty(pname))
					continue;
					
				if (value.isMjEntity) {
					switch (pname) {
					case 'isMjEntity':
					case 'entityService':
					case 'dkey':
					case 'gatewayURI':
						continue;
					}
				}
					
				var property = value[pname];
				if  (typeof property == 'function')
					continue;
				
				(function(o,p,vp,l){
					promises.push(toJson(vp, l+1).then(function(propJson){
						o[p] = propJson;
					}));
				})(objJson, pname, value[pname], level);
			}
			return Q.all(promises).then( function(){
				return objJson;
			} );
		}
		break;
		
	default:
		break;
	}
	
	return Q(value);
}

function toEntity(json) {
	return null;
}
