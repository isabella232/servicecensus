"use strict";

var path = require('path')
  , express = require('express')
  , flash = require('connect-flash')
  , compression = require('compression')
  , scrypt = require('scrypt')
  , passport = require('passport')

  , config = require('./lib/config')
  , i18n = require('./lib/i18n')
  , env = require('./lib/templateenv')
  , expressValidator = require('express-validator')
  ;

var app = express();

// CORS middleware
var CORSSupport = function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
};

// Cache-Control header middleware
var CacheControl = function (maxAge) {
  maxAge = parseInt(maxAge, 10);

  return function(req, res, next) {
    if (typeof res.get('Cache-Control') === 'undefined') {
      res.set('Cache-Control', 'public, max-age=' + maxAge);
    }
    next();
  };
};

var BasicAuth = express.basicAuth(function(user, pass) {
  var validUser = (user === config.get('appconfig:auth_user'));
  var validPass = scrypt.verifyHashSync(
    config.get('appconfig:auth_passhash'),
    pass
  );
  return validUser && validPass;
});

app.configure(function() {
  app.set('port', config.get('appconfig:port'));
  app.set('views', __dirname + '/templates');
  app.use(compression());
  if (config.get('appconfig:auth_on')) {
    app.use(BasicAuth);
  }
  if (!config.get('test:testing')) {
    app.use(express.logger('dev'));
  }
  app.use(express.favicon());
  app.use(express.bodyParser());
  app.use(expressValidator({
      customValidators: {
          isChoice: function(value) {
              var choices = ['Yes', 'No', 'Unsure'];
              if (choices.indexOf(value) > -1) {
                  return true;
              } else {
                  return false;
              }
          }
      }
  }));

  if (!config.get('appconfig:readonly')) {
    app.use(express.methodOverride());
    app.use(express.cookieParser());
    app.use(express.session({
      secret: process.env.SESSION_SECRET || 'dummysecret'
    }));
    app.use(passport.initialize());
    app.use(passport.session());
  }
  i18n.init(app);

  app.use(CORSSupport);
  app.use(flash());

  var staticRoot = path.join(__dirname, 'public');
  var staticOpts = {};
  if (config.get('appconfig:readonly')) {
    staticOpts.maxAge = 3600 * 1000;
  }
  app.use(express['static'](staticRoot, staticOpts));

  if (config.get('appconfig:readonly')) {
    app.use(CacheControl(1800));
  }

  app.locals.urlFor = urlFor;
});

env.express(app);

app.all('*', function(req, res, next) {
  if (config.get('test:testing') === true && !req.user && config.get('test:user')) {
    req.user = config.get('test:user');
  }
  if (req.cookies) {
    if (req.cookies.lang) {
      req.locale = req.cookies.lang;
    }
  }

  res.locals.currentUser = req.user ? req.user : null;

  if (config.get('appconfig:readonly')) {
    res.locals.readonly = true;
    // No session support in readonly mode, so fake it out:
    req.session = {};
    req.session.loggedin = false;
  }

  if (config.get('contribute_page') === '<h1>To set content for this page update your configuration file</h1>' ||
    config.get('contribute_page') === '' ||
    config.get('contribute_page') === undefined) {
    res.locals.has_contribute_page = false;
  } else {
    res.locals.has_contribute_page = true;
  }

  res.locals.locales = config.get('locales');
  res.locals.currentLocale = req.locale;
  res.locals.sitename = config.get('title', req.locale);
  res.locals.sitename_short = config.get('title_short', req.locale);
  res.locals.custom_css = config.get('custom_css');
  res.locals.google_analytics_key = config.get('google_analytics_key');
  res.locals.custom_footer = config.get('custom_footer', req.locale);
  res.locals.navbar_logo = config.get('navbar_logo', req.locale);
  res.locals.banner_text = config.get('banner_text', req.locale);
  res.locals.current_url = 'SCHEME://DOMAIN_PATH'.replace('SCHEME', req.protocol).replace('DOMAIN_', req.get('host')).replace('PATH', req.path);
  res.locals.current_domain = 'SCHEME://DOMAIN_'.replace('SCHEME', req.protocol).replace('DOMAIN_', req.get('host'));
  res.locals.post_submission_info = config.get('post_submission_info');
  res.locals.share_submission_template = config.get('share_submission_template', req.locale);
  res.locals.share_page_template = config.get('share_page_template', req.locale);
  res.locals.url_query = req.query;
  res.locals.error_messages = req.flash('error');
  res.locals.info_messages = req.flash('info');
  next();
});


// ========================================================
// Start routes
// ========================================================

var routes = require('./routes/core');

// Census specific routes must come first ...

// If we are NOT running in readonly mode, then load the "census" routes
if (!config.get('appconfig:readonly')) {
  console.log("WARNING: Loading in census mode. Data will be editable.");
  var census = require('./routes/census');

  app.get('/contribute', routes.contribute);
  app.get('/setlocale/:locale', routes.setlocale);
  app.get('/submit', census.submit);
  app.post('/submit', census.submit);
  app.get('/submission/:submissionid', census.submission);
  app.post('/submission/:submissionid', census.reviewPost);
  app.get('/login', census.login);
  app.post('/login', census.anonLogin);
  app.get('/auth/logout', census.logout);
  app.get('/auth/loggedin', census.loggedin);

  // admin
  app.get('/admin/reload', census.reload);

  app.get('/auth/google',
    passport.authenticate('google', { scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ]}
    )
  );
  app.get('/auth/google/callback',
    passport.authenticate('google', {
        successRedirect: '/auth/loggedin',
        failureRedirect: '/login',
        failureFlash: true,
        successFlash: true
      }
    )
  );

  // not using atm
//  app.get('/auth/facebook',
//      passport.authenticate('facebook', {scope: ['email']})
//  );
//  app.get('/auth/facebook/callback',
//    passport.authenticate('facebook', {
//        successRedirect: '/auth/loggedin',
//        failureRedirect: '/login',
//        failureFlash: true,
//        successFlash: true
//      }
//    )
//  );
}

app.get('/', routes.overview);
app.get('/about', routes.about);
app.get('/api/entries.:format', routes.api);
app.get('/faq', routes.faq);
app.get('/changes', routes.changes);
app.get('/overview.json', routes.resultJson);
app.get('/place/:place', routes.place);
app.get('/dataset/:dataset', routes.dataset);
app.get('/entry/:place/:dataset', routes.entryByPlaceDataset);

var redirects = require('./routes/redirects');
redirects.addRoutes(app);

function urlFor(name) {
  if (name === 'overview') {
    return '/';
  }
}

// ========================================================

exports.app = app;

