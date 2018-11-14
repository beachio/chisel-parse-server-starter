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

const SITE_TEMPLATES  = process.env.SITE_TEMPLATES           || config.extraConfig.siteTemplates;


Object.assign(parseConfig, {
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


app.listen(PORT, async () => {
  
  // set templates
  if (SITE_TEMPLATES) {
    const Parse = require('parse/node');
    
    Parse.initialize(APP_ID, null, MASTER_KEY);
    Parse.serverURL = URL_SERVER;
   
    const setTemplates = async () => {
      const templates = require('./siteTemplates/templates.json');
      const fs = require('fs');
    
      const Template = Parse.Object.extend('Template');
      const Model = Parse.Object.extend('Model');
      const ModelField = Parse.Object.extend('ModelField');
      
      for (let template of templates) {
        const template_o = new Template();
        
        template_o.set('name',        template.name);
        template_o.set('description', template.description);
    
        if (template.icon) {
          const iconData = fs.readFileSync(`./siteTemplates/icons/${template.icon}`);
          const iconFile = new Parse.File("icon.png", [...iconData]);
          await iconFile.save();
          template_o.set('icon', iconFile);
        }
        
        await template_o.save();
        
        for (let model of template.models) {
          const model_o = new Model();
          
          model_o.set('name',         model.name);
          model_o.set('nameId',       model.nameId);
          model_o.set('description',  model.description);
          model_o.set('color',        model.color);
          model_o.set('template', template_o);
          
          await model_o.save();
          
          for (let field of model.fields) {
            const field_o = new ModelField();
            field_o.set(field);
            field_o.set('model', model_o);
            field_o.save();
          }
        }
      }
    };
  
    // setting templates only if there are no templates
    const res = await new Parse.Query("Template").find();
    if (!res || !res.length)
      await setTemplates();
  }
  
  console.log(`Parse server running on port ${PORT}.`);
});
