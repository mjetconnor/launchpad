
var port = 8092;
var baseUrl = 'http://' + require('os').hostname() + ':' + port;

var app = require('express')();

var auth = require('./authentication')(app, baseUrl);
var api = require('./api')(app);

var entityService = require('./entityService');
entityService.setGatewayURI(baseUrl + '/api');

var serveStatic = require('serve-static');
app.get('/*',     serveStatic(__dirname + '/public'));

app.listen(port);

