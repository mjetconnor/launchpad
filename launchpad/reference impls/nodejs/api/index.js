
var entityService = require('../entityService');
var jsonConverter = require('./jsonSerializer');
var bodyParser = require('body-parser');

var ENTITY_PATH_PATTERN = /^\/[^_]/;

var notDskeys = [
	/^favicon\..*/, /^_/
];


module.exports = function(app) {

	app.all(ENTITY_PATH_PATTERN, function(req, res, next) {
		var pathSegs = req.path.split('/');
		pathSegs.shift(); // skip over the initial empty entry
		var dkey = pathSegs.shift() || 'system';
		var ekey = pathSegs.shift() || 'DATA';
		
		for (var i=notDskeys.length; i-->0; ) {
			if (notDskeys[i].test(dkey)) {
				console.log('Skipping entity endpoint for: ' + req.path);
				next();
				return;
			}
		}
		
		if (ekey != 'DATA' && dkey != 'system' && !/^\d/.test(ekey)) {
			pathSegs.unshift(ekey);
			ekey = 'DATA';
		}
		
		var entity = getEntity(dkey, ekey);
		
		loadAndEval(req, res, next, entity, pathSegs);
	});

	function loadAndEval(req, res, next, entity, pathSegs) {
		req.entity = entity;
		entity.load().then(function(){
			var result = entity;
			for (var nextSeg; nextSeg = pathSegs.shift(); ) {
				result = result[nextSeg];
				if (!result)
					break;
				if (result.isMjEntity) {
					return loadAndEval(req, res, next, result, pathSegs);
				}
			}
			
			req.result = result;
			next();
		})
		.catch(function(err){
			console.log('Error processing request: ' + err);
			req.result = undefined;
		})
		.done();
	}

	app.get(ENTITY_PATH_PATTERN,
		function(req, res, next) {
			if (!req.entity) {
				console.log('Skipping GET for non-entity: ' + req.path);
				next();
				return;
			}
				
			var acc = req.accepts(['json','html']);
			// console.log('Accepts: ' + req.headers.accept);
		
			switch (acc) {
			case 'html':
				res.redirect('/_ui/html/browser.htm#eid=' + req.entity.eid);
				break;
				
			case 'json':
				formatResult(req, res, undefined, req.result, req.entity);
				break;

			default:
				next();
				break;
			}
		});
	
	app.post(ENTITY_PATH_PATTERN,
		bodyParser(),
		function(req, res, next) {
			if (req.result !== req.entity)
				formatResult(req, res, 'Posting to something that is not an entity');
			req.entity.post(req.body)
			.then(function(result){
				formatResult(req, res, null, result, req.entity);
			})
			.catch(function(err){
				formatResult(req, res, err, null, req.entity);
			});
		});
	
	app.put(ENTITY_PATH_PATTERN,
		bodyParser(),
		function(req, res, next) {
			if (req.result !== req.entity)
				formatResult(req, res, 'Putting to something that is not an entity');
			req.entity.put(req.body, function(err, result){
				formatResult(req, res, err, result, req.entity);
			});
		});
}

function getEntity(dkey, ekey) {
	var eid = entityService.makeEid(dkey, ekey);
	return entityService.get(eid);
}

function formatResult(req, res, err, value, contextEntity) {
	var response = {
		version:'1.0',
		query:req.requestUrl
	};
	
	if (err) {
		response.error = err;
		res.json(response);
	}
	else {
		response.xmlns = {
		   'sief': 'http://purl.org/sief/2013/10/',
		   '_ds': contextEntity.gatewayURI + '/' + contextEntity.dkey,
		   '_host': contextEntity.gatewayURI
		}
		
		jsonConverter.toJson(value).then(function(resultJson){
			response.results = [resultJson];
			res.json(response);
		})
		.catch(function(err){
			response.error = err;
			res.json(response);
		})
		.done();
	}
	
}


