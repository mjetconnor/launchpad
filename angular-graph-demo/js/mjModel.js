/* mjModel */

var mjModel = angular.module('mjModel', ['authModule']);

mjModel.config(function($httpProvider){
	$httpProvider.defaults.useXDomain = true;
	delete $httpProvider.defaults.headers.common['X-Requested-With'];
});

function MjEntity(eid) {
	this.eid = eid;
}

mjModel.factory('mjg', function($http, $cacheFactory, authenticator){
	var mjg = {};
	var ecache = $cacheFactory('mjEntityCache');
	var collPageSize = 5;
	
	function doLog(msg) {
		if (window.console && window.console.log) {
			console.log(msg);
		}
	}

	mjg.get = function(eid, xmlns) {
		if (!eid)
			return undefined;
			
		if (xmlns) {
			eid = resolveEid(eid, xmlns);
		}
		
		var entity = ecache.get(eid);
		if (!entity) {
			entity = loadEntity(eid);
			ecache.put(eid, entity);
		}
		
		return entity;
	};
	
	function resolveEid(id, xmlns) {
		var match = /([\w_]+):(.+)/.exec(id);
		if (match) {
			var prefix = xmlns[match[1]];
			if (prefix)
				return prefix + match[2];
		}
		return id;
	}
	
	function handleHttpError(data, status, headers, config) {
		if (status == 401 && authenticator && authenticator.authenticate) {
			authenticator.authenticate();
		}
		else {
			doLog('Query failed to: ' + config.url);
		}
	}
			
	function loadEntity(eid) {
		doLog('loading ' + eid);
		var entity = new MjEntity(eid);
		
		var eidSegments = eid.split('/');
		entity.entityKey = eidSegments.pop();
		entity.dataSpaceKey = eidSegments.pop();
		entity.gatewayUrl = eidSegments.join('/');

		$http({
				method: 'GET'
				,url: eid
				,headers: {
					Authorization: 'Bearer ' + authenticator.accessToken
				}
			})
			.error(handleHttpError)
			.success(function(data, status, headers, config) {
				var edata = data.results[0];
				
				for (var p in edata) {
					switch (p) { // these values are already set
						case 'eid': continue;
					}
					if (edata.hasOwnProperty(p)) {
						unmarshall(entity, p, edata[p], data.xmlns);
					}
				}
			});
			
		return entity;
	}
	
	function unmarshall(o, p, v, xmlns) {
		if (!v)
			return;
		
		if (p!=undefined)
			o[p] = v;
		
		switch (typeof v) {
			default:
				break;

			case 'string':
				var match = /\s*(\d+)-(\d+)-(\d+)(T(\d+):(\d+):(\d+))?\s*/.exec(v);
				if (match) {
					o[p] = new Date(v);
				}
				break;

			case 'object':
				if (v.eid && p!=undefined) {
					var fullEid = resolveEid(v.eid, xmlns);
					o.__defineGetter__(p, function() {
						return mjg.get(fullEid); 
					});
					break;
				}
				
				if (v.data && (v.data instanceof Array)) {
					var a = [];
					o[p] = a;
					digestArrayBlock(a, v, xmlns, 0);
	                break;
				}

				for (var p2 in v) {
					if (v.hasOwnProperty(p2)) {
						unmarshall(v, p2, v[p2], xmlns);
					}
				}
				break;
		}
	}
	
	function loadNextBlock(nextPageUrl, a, xmlns, offset) {
		doLog( 'READING NEXT BLOCK -- ' + nextPageUrl);
		$http({
				method: 'GET'
				,url: nextPageUrl + '&pageSize=' + collPageSize
				,headers: {
					Authorization: 'Bearer ' + authenticator.accessToken
				}
			})
			.error(handleHttpError)
			.success(function(data, status, headers, config) {
				var edata = data.results[0];
				digestArrayBlock(a, edata, xmlns, offset);
			});
	}
	
	function digestArrayBlock(localArray, collData, xmlns, offset){
		for (var i=0,len=collData.data.length; i<len; i++) {
			unmarshall(localArray, i+offset, collData.data[i], xmlns);
		}
		if (collData.paging && collData.paging.next) {
			var newOffset = offset+collData.data.length;
			var callCheck = false;
			localArray.__defineGetter__(newOffset, function() {
				if (!callCheck) {
					callCheck = true;
					loadNextBlock(collData.paging.next, localArray, xmlns, newOffset);
				}
				return null;
			});
		}
	};					

	return mjg;
});

