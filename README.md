Parse Server
=====================

A Parse Server setup for Chisel - the open source API-first, headless CMS.
 
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

Parse Server will be running on `http://localhost:5000`



