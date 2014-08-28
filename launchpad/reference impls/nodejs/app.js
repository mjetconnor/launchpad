
var port = 8092;
var baseUrl = 'http://' + require('os').hostname() + ':' + port;

var app = require('express')();

var auth = require('./authentication')(app, baseUrl);
var api = require('./api')(app);

var entityService = require('./entityService');
entityService.setGatewayURI(baseUrl);

app.get('/favicon.ico', 
	require('serve-static')(__dirname)
);
app.get('/_ui/*', 
	require('serve-static')(__dirname)
);

app.listen(port);

