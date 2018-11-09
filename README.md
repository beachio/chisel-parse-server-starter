Parse Server
=====================

A Parse Server setup for [Chisel](https://github.com/beachio/chisel) — the open source API-first, headless CMS. It based on [Parse Server](https://github.com/parse-community/parse-server).

## One Click Deploy to Heroku

Setting up a hosted Parse Server instance is easy with Heroku.

Click the button below and follow these these steps...

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

If you want to setup Parse Server on Heroku the long way, [follow these steps](https://devcenter.heroku.com/articles/deploying-a-parse-server-to-heroku)

## Local Setup

Should you want to run your Parse Server instance locally, you can...

Clone this repository locally.

``` bash
git clone <repo url>
cd <project name>
```

You should install MongoDB (if you haven't it yet):
``` bash
brew install mongodb
```

Before running server, you should start MongoDB daemon:
``` bash
mongod --dbpath <path to data directory>
```

Install Dependencies
``` bash
npm install
```

Next, run server:
``` bash
npm start
```

Parse Server will be running on `http://localhost:1337/parse`

## Configuration

You can setup configuration in `config.json` file. Also some parameters can be passed by `process.env`.
In `config.json` file, in `parseConfig` object you can pass any parameters of original Parse Server, so checkout its docs. 
Main parameters with `process.env` aliases:

| Parameter | config.json  | process.env  |
| :---:   | :-: | :-: |
| Parse server port | port | PORT |
| Parse server URL | URLserver | SERVER_URL |
| Database URI | URLdb | DATABASE_URI, MONGODB_URI |
| Chisel site URL | URLsite | SITE_URL |
| Parse application ID | appId | APP_ID |
| Parse master key | masterKey | MASTER_KEY |

In `emailAdapter` there are settings for email adapter. To using email features (users' verification) you should replace `fromAddress`, `domain` and `apiKey` parameters to yours (or even change the adapter if you don't use Mailgun).

Also you can configure integrated Parse Dashboard (in `extraConfig` object in `config.js`):

| Parameter | config.json  | process.env  |
| :---:   | :-: | :-: |
| Dashboard enabled | dashboardActivated | DASHBOARD_ACTIVATED |
| Email for dashboard | userEmail | USER_EMAIL |
| Password for dashboard | userPassword | USER_PASSWORD |
