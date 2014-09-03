(function () {

  var auth0 = angular.module('auth0', ['ngCookies', 'ngRoute']);

  function Auth0Wrapper(auth0Lib, $cookies, $rootScope, $safeApply, $q) {
    this.auth0Lib = auth0Lib;
    this.$cookies    = $cookies;
    this.$rootScope  = $rootScope;
    this.$safeApply  = $safeApply;
    this.$q          = $q;
  }

  Auth0Wrapper.prototype = {};

  Auth0Wrapper.prototype.parseHash = function (locationHash, callback) {
    this.auth0Lib.parseHash(locationHash, callback);
  };

  Auth0Wrapper.prototype._deserialize = function () {
    if (!this.$cookies.profile) {
      this.isAuthenticated = false;
      this.profile = undefined;
      this.idToken = undefined;
      this.accessToken = undefined;
      return;
    }

    this.profile = JSON.parse(this.$cookies.profile);
    this.isAuthenticated = !!this.profile;
    this.idToken = this.$cookies.idToken;
    this.accessToken = this.$cookies.accessToken;
  };

  Auth0Wrapper.prototype._serialize = function (profile, id_token, access_token) {
    this.$cookies.profile = JSON.stringify(profile);
    this.$cookies.idToken = id_token;
    this.$cookies.accessToken = access_token;
  };

  Auth0Wrapper.prototype.signin = function (options, callback) {
    options = options || {};

    var that = this;
    var deferred = that.$q.defer();

    if (!options.popup && callback) {
      throw new Error('Since you are using "redirect" mode, the callback you defined will never be called.');
    }

    that.auth0Lib.signin(options, function(err, profile, id_token, access_token, state) {
      if (err) {
        return deferred.reject(err);
      }
      
      that._serialize(profile, id_token, access_token, state);
      that._deserialize();
      
      that.$safeApply(undefined, callback);

      return deferred.resolve();
    });

    return deferred.promise;
  };

  Auth0Wrapper.prototype.signout = function () {
    this._serialize(undefined, undefined, undefined);
    this._deserialize();
  };

  Auth0Wrapper.prototype.getProfile = function (locationHash, callback) {
    var that = this;

    var wrappedCallback = function() {
      that.$safeApply(undefined, callback.apply(null, arguments));
    };

    this.auth0Lib.getProfile(locationHash, wrappedCallback);
  };

  Auth0Wrapper.prototype.signup = function (options) {
    this.auth0Lib.signup(options);
  };

  Auth0Wrapper.prototype.reset = function (options) {
    this.auth0Lib.reset(options);
  };

  auth0.provider('auth', function () {
    var auth0Wrapper, auth0Lib;

    this.init = function (options) {
      if (options.callbackOnLocationHash === undefined) {
        options.callbackOnLocationHash = true;
      }

      // User has included widget
      if (typeof Auth0Widget !== 'undefined') {
        auth0Lib = new Auth0Widget(options);
      } else {
        auth0Lib = new Auth0(options);
      }

    };

    this.$get = function ($cookies, $rootScope, $safeApply, $q) {
      if (!auth0Lib) {
        throw new Error('You need add to your config Auth0 initialization');
      }

      if (!auth0Wrapper) {
        auth0Wrapper = new Auth0Wrapper(auth0Lib, $cookies, $rootScope, $safeApply, $q);
      }

      return auth0Wrapper;
    };
  });

  // Why $route if we are not using it? See https://github.com/angular/angular.js/issues/1213
  auth0.run(function (auth, $cookies, $location, $rootScope, $window, $route) {

    // this is only used when doing social authentication in redirect mode (auth.signin({connection: 'google-oauth2'});)
    auth.getProfile($window.location.hash, function (err, profile, id_token, access_token, state) {
      if (err) {
        return $rootScope.$broadcast('auth:error', err);
      }

      auth._serialize(profile, id_token, access_token, state);
      auth._deserialize();

      $location.path('/');
    });

    // this will rehydrate the "auth" object with the profile stored in $cookies
    auth._deserialize();
  });

  auth0.factory('$safeApply', function safeApplyFactory($rootScope, $exceptionHandler) {
    return function safeApply(scope, expr) {
      scope = scope || $rootScope;
      if (['$apply', '$digest'].indexOf(scope.$root.$$phase) !== -1) {
        try {
          return scope.$eval(expr);
        } catch (e) {
          $exceptionHandler(e);
        }
      } else {
        return scope.$apply(expr);
      }
    };
  });

  var authInterceptorModule = angular.module('authInterceptor', ['auth0']);

  authInterceptorModule.factory('authInterceptor', function (auth, $rootScope, $q) {
    return {
      request: function (config) {
        config.headers = config.headers || {};
        if (auth.idToken) {
          config.headers.Authorization = 'Bearer '+ auth.idToken;
        }
        return config;
      },
      responseError: function (response) {
        // handle the case where the user is not authenticated
        if (response.status === 401) {
          $rootScope.$broadcast('auth:forbidden', response);
        }
        return response || $q.when(response);
      }
    };
  });

  authInterceptorModule.config(function ($httpProvider) {
    $httpProvider.interceptors.push('authInterceptor');
  });


}());