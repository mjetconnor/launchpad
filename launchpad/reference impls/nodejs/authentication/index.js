
// Set up sessions and authorization
var passport = require('passport');
var auth0Setup = require('./auth0');
var jwt = require('express-jwt');   // npm install express-jwt

module.exports = function(app, baseUrl) {
	app.use( require('cookie-parser')() );
	app.use( require('express-session')( { secret: 'shhhhhhhhh' } ) );
	// other options on session() can set cookie maxAge, for instance

	app.use(passport.initialize());
	app.use(passport.session());
	// this maintains authentication status and user profile, if set by other passport "stategies"

	var auth0config = auth0Setup(app, baseUrl);

	var jwtAuthenticate = jwt({
		secret: new Buffer(auth0config.clientSecret, 'base64'),
		audience: auth0config.clientID
	});
	
	app.use('/api', jwtAuthenticate);

	// if no active auth in the session, redirect to '/authenticate'
	app.use('/api/*', require('connect-ensure-login').ensureLoggedIn('/authenticate'));
	
}
