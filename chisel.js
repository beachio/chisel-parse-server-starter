const express = require('express');
const resolve = require('path').resolve;
const ParseServer = require('parse-server').ParseServer;


const mailgunConfig = {
  fromAddress: "parse@charliedisney.com",
  domain: "charliedisney.com",
  apiKey: "key-6488b75d22dfe878cf83f1753d64f825"
};
module.exports.mailgunConfig = mailgunConfig;

const api = new ParseServer({
  appId: "d5701a37cf242d5ee398005d997e4229",
  masterKey: "5a70dd9922602c26e6fac84d611decb4",
  appName: "Chisel",
  cloud: "./cloud/chisel",
  databaseURI: "mongodb://127.0.0.1:27017/parse",
  
  serverURL: 'http://localhost:1337/parse',
  
  verifyUserEmails: true,
  preventLoginWithUnverifiedEmail: true,
  publicServerURL: "http://localhost:1337/parse",
  
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
        }
      }
    })
  }
});

let app = new express();

// Serve the Parse API on the /parse URL prefix
app.use('/parse', api);

app.listen(1337, () => {
  console.log('Parse server running on port 1337.');
});
