Parse server
=====================

A Parse server for Chisel project.
 

## Build Setup

First, you should install MongoDB (if you haven't it yet):
``` bash
brew install mongodb
```

Before running server, you should start MongoDB daemon:
``` bash
mongod --dbpath <path to data directory>
```
 
Next, run server:
``` bash
npm start
```
The server will listen 5000 port.


[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)