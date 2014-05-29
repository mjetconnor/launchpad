
module.exports = {
	toJson: toJson,
	toEntity: toEntity
}

function toJson(value, level) {
	level = level || 0;
	
	switch (typeof value) {
	case 'function':
		return undefined;
		
	case 'object':
		if (value instanceof Date) {
			return value.toISOString();
		}
		else if (value instanceof Array) {
			var serialized = [];
			for (var i=0; i<value.length; i++) {
				serialized.push(toJson(value[i], level+1));
			}
			return {data:serialized};
		}
		else if (value.isMjEntity && level>0) {
			return {eid:value.eid, type:value.type}
		}
		else {
			var serialized = {};
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
					
				serialized[pname] = toJson(value[pname], level+1);
			}
			return serialized;
		}
		break;
		
	default:
		break;
	}
	
	return value;
}

function toEntity(json) {
	return null;
}
