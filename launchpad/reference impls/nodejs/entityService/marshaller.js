
module.exports = {
	marshal: marshal,
	unmarshal: unmarshal
}


// Convert from native object to database format
function marshal(dataSpace, data) {
	if (!data)
		return;
	
	if (data.isMjEntity) {
		if (dataSpace && dataSpace.matches(data.dataSpace))
			return '_ds:' + data.entityKey;
		else
			return '_host:' + data.dkey + '/' + data.entityKey;
	}
	else
	if (data instanceof Date)
		return data;
	else
	if (Array.isArray(data)) {
		// marshal the elements of the array
		converted = [];
		for (var i=0; i<data.length; i++) {
			converted[i] = marshal(dataSpace, data[i]);
		}
		return converted;
	}
	else
	if (typeof data == 'object') {
		var converted = {};
		for (var p2 in data) {
			if (data.hasOwnProperty(p2)) {
				converted[p2] = marshal(dataSpace, data[p2]);
			}
		}
		return converted;
	}
	
	return data;
}

// Convert from database format to native object
function unmarshal(context, data, container, pname) { // from database
	if (!data)
		return;
	
	if (pname != undefined)
		container[pname] = data; // might get overwritten below
	
	if (Array.isArray(data)) {
		var newArray = container[pname] = [];
		for (var i=0; i<data.length; i++) {
			unmarshal(context, data[i], newArray, i);
		}
		return;
	}
	
	if (data instanceof Date)
		return;
		
	switch (typeof data) {
		default:
			return;

		case 'string':
			var match = /([\w_]+):(.+)/.exec(data);
			if (match) {
				var eid;
				switch (match[1]) {
				case '_ds':
					eid = getDataSpace(context).makeEid(match[2]);
					break;
					
				case '_host':
					match = /^(.*)\/(.*)$/.exec(match[2]);
					eid = getEntityService(context).makeEid(match[1], match[2]);
					break;
				}

				if (eid) {
					container.__defineGetter__(pname, function() {
						return container[pname] = getEntityService(context).get(eid);
					});
				}
				return;
			}
			
			match = /\s*(\d+)-(\d+)-(\d+)(T(\d+):(\d+):(\d+))?\s*/.exec(data);
			if (match) {
				container[pname] = new Date(data);
				return;
			}

			break;

		case 'object':
			var newObj = {};
			container[pname] = newObj;
			for (var p2 in data) {
				if (data.hasOwnProperty(p2)) {
					unmarshal(context, data[p2], newObj, p2);
				}
			}
			return;
	}
}

function getDataSpace(obj) {
	if (obj.isMjEntity)
		return obj.dataSpace;
}

function getEntityService(obj) {
	if (obj.isMjEntity)
		return obj.entityService;
	return obj;
}


