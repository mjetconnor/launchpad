/*  mjAuth.js  */

/* Parse query parameter style name/value pairs into an associative array,
	(IOW a simple Javascript object)
*/
function parseParams(paramStr) {
	if (!paramStr)
		return {};
	var map = {};
	var arr = paramStr.split('&');
	for (var spl, i = 0; i < arr.length; i++) {
		spl = arr[i].split('=');
		map[spl[0]] = decodeURIComponent(spl[1]);
	}
	return map;
}


var authModule = angular.module('authModule', []);

authModule.factory('authenticator', function(){
	var auth = {
		session: null,

		/* change who the authentication authority is */
		setAuthority: function(authUrl, clientId) {
			auth.session = {
				authorityUrl: authUrl,
				clientId: clientId
			};
		},
		
		/* perform an authentication using the currently configured authority */
		authenticate: function() {
			if (!auth.session)
				return;
				
			var authorityUrl = auth.session.authorityUrl;
			if (auth.session.authorityError || !authorityUrl)
				return;
			
			var baseUrl = window.location.href;
			baseUrl = /^([^#]*)/.exec(baseUrl)[1]; // the location without the hash

			console.log('reauthenticating...');
			var redirUrl = authorityUrl
				+ '/oauth/authorize?response_type=token&client_id='+auth.session.clientId+'&redirect_uri='
				+ encodeURIComponent(baseUrl) + '&state=' + encodeURIComponent(authorityUrl);
				
			window.location = redirUrl;
		},
		
		/* do this on entry to the app */
		checkOnEntry: function() {
			// Check if we are receiving a return redirection that contains access info in the hash tag
			var hash = window.location.hash;
			if (hash) {
				var params = parseParams(hash.replace(/^\#/,''));
				
				if (params.error) {
					auth.session.authorityError = params.error;
					return;
				}

				if (params.access_token) {
					auth.session = {
						accessToken:  params.access_token,
						meUri:        params.userId,
						homeUri:      params.communityId,
						authorityUrl: params.state
					};
					
					// {expires: 365, path: '/'}
					$.cookie('mjg.session', auth.session, {expires: 365, path: '/'});
					
					// hide the auth info by navigating to the same URL without the hash tag
					window.location.hash = null;
					return;
				}
			}
			
			// Look for access info in cookies
			auth.session = $.cookie('mjg.session');

			// If nothing in the cookies, gotta authenticate now
			if (auth.session) {
				if ((!auth.session.accessToken || !auth.session.meUri) && auth.session.authorityUrl) {
					auth.authenticate();
				}
			}
		}
	};
	
	return auth;
});

authModule.run(function(authenticator) {
	authenticator.checkOnEntry();
});
