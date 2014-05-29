
var auth0config ={
    domain:       'mindjet.auth0.com',
    clientID:     'bSSul8KsxvskaLg3SnPn223fAVXEI9b7',
    clientSecret: 'Lu3N01rZV1za8zWXvF7ePtCfCHzrWj7ZiwM4zxK5Y3dpSzTOqRAF0sWPhPF22SVW',
    callbackURL:  '/auth0callback'
  };

var passport = require('passport');
var Auth0Strategy = require('passport-auth0');


module.exports = function(app, baseUrl) {
	app.get('/authenticate', function(req, res) {
		var redirUrl = 'https://' + auth0config.domain + '/authorize/?'
			+ 'response_type=code&client_id=' + auth0config.clientID 
			+ '&redirect_uri=' + baseUrl + auth0config.callbackURL + '&state=12321';
		console.log('auth redir: ' + redirUrl);
		res.redirect(redirUrl);
	});

	// When Auth0 completes authentication, it redirects to here.
	// Note that req.session.returnTo was originally set in ensureLoggedIn()
	// In that way, successful authentication naturally goes back to the original URL
	//     that the user tried to navigate to.
	app.get('/auth0callback',
		passport.authenticate('auth0', { failureRedirect: '/error.htm' }),
		function(req, res) {
			if (!req.user) { throw new Error('user null'); }
			req.session.user = req.user;
			return res.redirect(req.session.returnTo);
		}
	);
	
	var strategy = new Auth0Strategy(auth0config,
		function(accessToken, refreshToken, profile, cb) {
			return cb(null, {name:profile.displayName, token:accessToken});
	});
	
	passport.use(strategy);
	
	passport.serializeUser(function(user, cb) {
	  cb(null, user);  // TODO
	});

	passport.deserializeUser(function(username, cb) {
	  cb(null, username);  // TODO
	});

	return auth0config;
};


