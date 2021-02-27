const express = require('express');
const { default: ParseServer, ParseGraphQLServer } = require('@nessi/parse-server');
const ParseDashboard = require('parse-dashboard');
const Parse = require('parse/node');
const request = require('request');
const { claimPoints } = require('./cloud/mural');

const http = require('http');
const path = require('path');
const fs = require('fs');

const packageJSON = require('./package.json');

const config = require('./config.json');

let parseConfig = config.parseConfig;
let StripeConfig = config.extraConfig.StripeConfig;

const PORT            = process.env.PORT          || parseConfig.port;
const URL_SERVER      = process.env.SERVER_URL    || parseConfig.URLserver;
const GRAPHQL_SERVER  = process.env.GRAPHQL_SERVER_URL    || parseConfig.GraphQLURLserver;
const URL_DB          = process.env.DATABASE_URI  ||
                    process.env.MONGODB_URI   || parseConfig.URLdb;
const URL_SITE        = process.env.SITE_URL      || parseConfig.URLsite;
const APP_ID          = process.env.APP_ID        || parseConfig.appId;
const MASTER_KEY      = process.env.MASTER_KEY    || parseConfig.masterKey;

const DASHBOARD_ACTIVATED = process.env.DASHBOARD_ACTIVATED || config.extraConfig.dashboardActivated;
const DASH_USER_EMAIL     = process.env.USER_EMAIL          || config.extraConfig.userEmail;
const DASH_USER_PASSWORD  = process.env.USER_PASS           || config.extraConfig.userPassword;

const SITE_TEMPLATES      = process.env.SITE_TEMPLATES      || config.extraConfig.siteTemplates;


let emailOptions = parseConfig.emailAdapter.options;
emailOptions.fromAddress  = process.env.FROM_ADDRESS    || emailOptions.fromAddress;
emailOptions.domain       = process.env.MAILGUN_DOMAIN  || emailOptions.domain;
emailOptions.apiKey       = process.env.MAILGUN_API_KEY || emailOptions.apiKey;


Object.assign(parseConfig, {
  appId: APP_ID,
  masterKey: MASTER_KEY,
  cloud: "./cloud/main",
  databaseURI: URL_DB,

  serverURL: URL_SERVER,
  publicServerURL: URL_SERVER,

  liveQuery: {
    classNames: ['Site', 'Model', 'ModelField', 'ct____.*']
  }
});

const cps = parseConfig.customPages;
for (let p in cps) {
  cps[p] = URL_SITE + cps[p];
}

module.exports.parseConfig = parseConfig;
module.exports.URL_SITE = URL_SITE;
module.exports.StripeConfig = StripeConfig;


const parseServer = new ParseServer(parseConfig);
const parseGraphQLServer = new ParseGraphQLServer(
  parseServer,
  {graphQLPath: '/graphql'}
);
const app = new express();
app.use('/parse', parseServer.app);
parseGraphQLServer.applyGraphQL(app);

app.use('/callback', function(req, res) {
  console.log("----------------CALLBACK REQUEST---------------", req.query);
  // http://localhost:1337/callback?code=2fa9409b-6dd5-44a7-b58a-9381c1f9351e&scopes=profile%3Aread&state=Alfred
  res.send({status: 'OK'});
})

app.use('/claimPoints', async function(req, res) {
  const result = await claimPoints(req.query.code, req.query.participant, req.query.siteId);
  res.send(result);
})

if (DASHBOARD_ACTIVATED) {
  const dashboardConfig = {
    apps: [{
      serverURL: URL_SERVER,
      graphQLServerURL: GRAPHQL_SERVER,
      appId: APP_ID,
      masterKey: MASTER_KEY,
      appName: parseConfig.appName
    }],
    trustProxy: 1,
    PARSE_DASHBOARD_ALLOW_INSECURE_HTTP: 1,
    allowInsecureHTTP: 1
  };

  if (DASH_USER_EMAIL && DASH_USER_PASSWORD)
    dashboardConfig.users = [{
      user: DASH_USER_EMAIL,
      pass: DASH_USER_PASSWORD
    }];

  module.exports.dashboardConfig = dashboardConfig;
  const dashboard = new ParseDashboard(dashboardConfig, {allowInsecureHTTP: true});
  app.use('/dashboard', dashboard);
}


const postStart = async () => {
  Parse.initialize(APP_ID, null, MASTER_KEY);
  Parse.serverURL = URL_SERVER;

  if (StripeConfig) {
    try {
      await request({
        url: URL_SERVER + '/config',
        method: 'PUT',
        json: true,
        headers: {
          'X-Parse-Application-Id': parseConfig.appId,
          'X-Parse-Master-Key': parseConfig.masterKey
        },
        body: {params: {StripeKeyPublic: StripeConfig.keyPublic}}
      });

    } catch (e) {
      console.error(e);
    }
  }

  // set templates
  if (SITE_TEMPLATES) {
    const templates = require('./siteTemplates/templates.json');

    const Template = Parse.Object.extend('Template');
    const Model = Parse.Object.extend('Model');
    const ModelField = Parse.Object.extend('ModelField');

    const ACL = new Parse.ACL();
    ACL.setPublicReadAccess(true);
    ACL.setPublicWriteAccess(false);

    for (let template of templates) {
      const res = await new Parse.Query("Template")
        .equalTo('name', template.name)
        .first();
      if (res)
        continue;

      const template_o = new Template();

      template_o.set('name',        template.name);
      template_o.set('description', template.description);
      template_o.setACL(ACL);

      if (template.icon) {
        const iconData = fs.readFileSync(`./siteTemplates/icons/${template.icon}`);
        const iconFile = new Parse.File("icon.png", [...iconData]);
        await iconFile.save(null, {useMasterKey: true});
        template_o.set('icon', iconFile);
      }

      await template_o.save(null, {useMasterKey: true});

      for (let model of template.models) {
        const model_o = new Model();

        model_o.set('name',         model.name);
        model_o.set('nameId',       model.nameId);
        model_o.set('description',  model.description);
        model_o.set('color',        model.color);
        model_o.set('template', template_o);
        model_o.setACL(ACL);

        await model_o.save(null, {useMasterKey: true});

        for (let field of model.fields) {
          const field_o = new ModelField();
          field_o.set(field);
          field_o.set('model', model_o);
          field_o.setACL(ACL);
          field_o.save(null, {useMasterKey: true});
        }
      }
    }
  }
};

// Clearing logs
const clearLogInterval = 1000 * 60 * 60 * 24;
const logsDirectory = './logs';
function clearLogs () {
  fs.readdir(logsDirectory, (err, files) => {
    if (err)
      console.error(err);

    for (const file of files) {
      fs.unlink(path.join(logsDirectory, file), err => {
        if (err)
          console.error(err);
      });
    }
    console.info("Logs was cleaned");
  });
}
clearLogs();
setInterval(clearLogs, clearLogInterval);


const httpServer = http.createServer(app);
httpServer.listen(PORT, async () => {
  await postStart();
  console.log(`Chisel Parse server v${packageJSON.version} running on port ${PORT}.`);
});

const lqServer = ParseServer.createLiveQueryServer(httpServer);
