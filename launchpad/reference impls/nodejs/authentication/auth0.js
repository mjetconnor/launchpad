
var passport = require('passport');
var Auth0Strategy = require('passport-auth0');
var entityService = require('../entityService');


var auth0config ={
    domain:       'mindjet.auth0.com',
    clientID:     'bSSul8KsxvskaLg3SnPn223fAVXEI9b7',
    clientSecret: 'Lu3N01rZV1za8zWXvF7ePtCfCHzrWj7ZiwM4zxK5Y3dpSzTOqRAF0sWPhPF22SVW',
    callbackURL:  '/_auth/callback'
  };


module.exports = function(app, baseUrl) {
	app.get('/_auth/login', function(req, res) {
		var redirUrl = 'https://' + auth0config.domain + '/authorize/?'
			+ 'response_type=code&client_id=' + auth0config.clientID 
			+ '&redirect_uri=' + baseUrl + auth0config.callbackURL + '&state=12321';
		res.redirect(redirUrl);
	});

	// When Auth0 completes authentication, it redirects to here.
	// Note that req.session.returnTo was originally set in ensureLoggedIn()
	// In that way, successful authentication naturally goes back to the original URL
	//     that the user tried to navigate to.
	app.get('/_auth/callback',
		passport.authenticate('auth0', { failureRedirect: '/error.htm' }),
		function(req, res) {
			if (!req.user) { throw new Error('user null'); }
			req.session.user = req.user;
			return res.redirect(req.session.returnTo);
		}
	);
	
	var strategy = new Auth0Strategy(auth0config,
		function(accessToken, refreshToken, profile, cb) {
		
		    return cb(null, {name:profile.displayName});

			/*
			var mbox = profile.emails[0].value;
			var connId = profile.identities[0].connection;
			
			entityService.systemSpace.selectOne(
				'{?result a _:Tenant, _:auth0connector ?connId}',
				{connId: connId},
				function(err, tenant) {
					tenant.onLoad(function(err){
						tenant.communities[0].dataSpace.selectOne(
							'{?result a _:User, _:mbox ?mbox}',
							{mbox: mbox},
							function(err, user){
								... if (!user) need to create in tenant using the incoming metadata
								return cb(null, {me:user});
						});
					});
			});
			*/
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


