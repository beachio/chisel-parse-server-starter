const express = require('express');
const resolve = require('path').resolve;
const ParseServer = require('parse-server').ParseServer;


const PORT = process.env.PORT || 1337;
const URL_SERVER = process.env.SERVER_URL || `http://localhost:${PORT}/parse`;
const URL_DB = process.env.DATABASE_URI || process.env.MONGODB_URI || `mongodb://localhost:27017/parse`;
const URL_SITE = process.env.SITE_URL || `http://localhost:9000`;
const URL_CONTENT_HOOK = ``;
const APP_ID = process.env.APP_ID || 'SampleAppId';
const MASTER_KEY = process.env.MASTER_KEY || 'SampleMasterKey';

module.exports['URL_SITE'] = URL_SITE;
module.exports['URL_CONTENT_HOOK'] = URL_CONTENT_HOOK;


const mailgunConfig = {
  fromAddress: "parse@charliedisney.com",
  domain: "charliedisney.com",
  apiKey: "key-6488b75d22dfe878cf83f1753d64f825"
};
module.exports.mailgunConfig = mailgunConfig;

const parseConfig = {
  appId: APP_ID,
  masterKey: MASTER_KEY,
  appName: "Chisel",
  cloud: "./cloud/main",
  databaseURI: URL_DB,
  
  serverURL: URL_SERVER,
  publicServerURL: URL_SERVER,
  
  maxUploadSize: `10mb`,
  
  verifyUserEmails: true,
  preventLoginWithUnverifiedEmail: true,
  
  emailAdapter: {
    module: "parse-server-mailgun",
    options: Object.assign(mailgunConfig, {
      templates: {
        passwordResetEmail: {
          subject: 'Reset your password',
          pathPlainText: resolve(__dirname, 'mailTemplates/passwordReset.txt'),
          pathHtml: resolve(__dirname, 'mailTemplates/passwordReset.html'),
        },
        verificationEmail: {
          subject: 'Confirm your account',
          pathPlainText: resolve(__dirname, 'mailTemplates/emailVerify.txt'),
          pathHtml: resolve(__dirname, 'mailTemplates/emailVerify.html')
        },
        inviteEmail: {
          subject: 'Inviting you to Chisel',
          pathPlainText: resolve(__dirname, 'mailTemplates/invite.txt'),
          pathHtml: resolve(__dirname, 'mailTemplates/invite.html')
        }
      }
    })
  },
  
  customPages: {
    verifyEmailSuccess:   `${URL_SITE}/email-verify`,
    choosePassword:       `${URL_SITE}/password-set`,
    passwordResetSuccess: `${URL_SITE}/password-set-success`,
    invalidLink:          `${URL_SITE}/invalid-link`
  }
};
module.exports.parseConfig = parseConfig;

const api = new ParseServer(parseConfig);

let app = new express();

// Serve the Parse API on the /parse URL prefix
app.use('/parse', api);

app.listen(PORT, () => {
  console.log(`Parse server running on port ${PORT}.`);
});
