
var entityService = require('../entityService');
var jsonConverter = require('./entity2json');
var bodyParser = require('body-parser');

module.exports = function(app) {

	app.all('/api/:dkey/:ekey',
		bodyParser(),
		function(req, res, next) {
			var entity = getEntity(req.params.dkey, req.params.ekey);
			entity.onLoad(function(err, entity){
				var result;
				
				switch (req.method) {
				case "GET":
					formatResult(req, res, err, entity, entity);
					return;
					
				case "POST":
					entity.post(req.body, function(err, result){
						formatResult(req, res, err, result, entity);
					});
					return;
					
				case "PUT":
					entity.put(req.body, function(err, result){
						formatResult(req, res, err, result, entity);
					});
					return;

				default:
					formatResult(req, res, 'Unsupported HTTP method: ' + req.method);
					return;
				}
			});
		}
	);

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
	}
	else {
		response.xmlns = {
		   'sief': 'http://purl.org/sief/2013/10/',
		   '_ds': contextEntity.gatewayURI + '/' + contextEntity.dkey,
		   '_host': contextEntity.gatewayURI
		}
		var resultJson = jsonConverter.toJson(value);
		response.results = [resultJson];
	}
	
	res.json(response);
}


