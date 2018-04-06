const express = require('express');
const ParseServer = require('parse-server').ParseServer;
const ParseDashboard = require('parse-dashboard');


const config = require('./config.json');
let parseConfig = config.parseConfig;

const PORT        = process.env.PORT          || parseConfig.port;
const URL_SERVER  = process.env.SERVER_URL    || parseConfig.URLserver;
const URL_DB      = process.env.DATABASE_URI  ||
                    process.env.MONGODB_URI   || parseConfig.URLdb;
const URL_SITE    = process.env.SITE_URL      || parseConfig.URLsite;
const APP_ID      = process.env.APP_ID        || parseConfig.appId;
const MASTER_KEY  = process.env.MASTER_KEY    || parseConfig.masterKey;

const DASHBOARD_ACTIVATED = process.env.DASHBOARD_ACTIVATED || config.extraConfig.dashboardActivated;
const DASH_USER_EMAIL     = process.env.USER_EMAIL          || config.extraConfig.userEmail;
const DASH_USER_PASSWORD  = process.env.USER_PASS           || config.extraConfig.userPassword;

parseConfig = Object.assign(parseConfig, {
  appId: APP_ID,
  masterKey: MASTER_KEY,
  cloud: "./cloud/main",
  databaseURI: URL_DB,
  
  serverURL: URL_SERVER,
  publicServerURL: URL_SERVER
});

const cps = parseConfig.customPages;
for (let p in cps) {
  cps[p] = URL_SITE + cps[p];
}

module.exports.parseConfig = parseConfig;
module.exports.URL_SITE = URL_SITE;
//module.exports.mailgunConfig = parseConfig.emailAdapter.options;


const API = new ParseServer(parseConfig);
const app = new express();
app.use('/parse', API);


if (DASHBOARD_ACTIVATED) {
  const dashboardConfig = {
    apps: [{
      serverURL: URL_SERVER,
      appId: APP_ID,
      masterKey: MASTER_KEY,
      appName: parseConfig.appName
    }],
    users: [{
      user: DASH_USER_EMAIL,
      pass: DASH_USER_PASSWORD
    }],
    trustProxy: 1,
    PARSE_DASHBOARD_ALLOW_INSECURE_HTTP: 1,
    allowInsecureHTTP: 1
  };

  module.exports.dashboardConfig = dashboardConfig;
  const dashboard = new ParseDashboard(dashboardConfig, {allowInsecureHTTP: true});
  app.use('/dashboard', dashboard);
}


app.listen(PORT, () => {
  console.log(`Parse server running on port ${PORT}.`);
});
