console.log('Cloud code connected');


const configs = require('../index.js');
const config = configs.parseConfig;
const SITE = configs['URL_SITE'];


const ROLE_ADMIN = "ADMIN";
const ROLE_EDITOR = "EDITOR";


const promisifyW = pp => {
  return new Promise((rs, rj) => pp.then(rs, rs));
};

const checkRights = (user, obj) => {
  const acl = obj.getACL();
  if (!acl)
    return true;

  const read = acl.getReadAccess(user.id);
  const write = acl.getWriteAccess(user.id);

  const pRead = acl.getPublicReadAccess();
  const pWrite = acl.getPublicWriteAccess();
  
  return read && write || pRead && pWrite;
};

const getAllObjects = query => {
  const MAX_COUNT = 50;
  let objects = [];
  
  let getObjects = (offset = 0) => {
    return query
      .limit(MAX_COUNT)
      .skip(offset)
      .find({useMasterKey: true})
      .then(res => {
        if (!res.length)
          return objects;
        
        objects = objects.concat(res);
        return getObjects(offset + MAX_COUNT);
      })
  };
  
  return getObjects();
};


const getTableData = table => {
  const endpoint = '/schemas/' + table;
  
  return new Promise((resolve, reject) => {
    Parse.Cloud.httpRequest({
      url: config.serverURL + endpoint,
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': config.appId,
        'X-Parse-Master-Key': config.masterKey
      }
    })
      .then(response => {
        if (response.status == 200)
          resolve(response.data);
        else
          resolve(null);
      }, () => resolve(null));
  });
};

const setTableData = (table, data, method = 'POST') => {
  const endpoint = '/schemas/' + table;
  
  return new Promise((resolve, reject) => {
    Parse.Cloud.httpRequest({
      url: config.serverURL + endpoint,
      method,
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': config.appId,
        'X-Parse-Master-Key': config.masterKey
      },
      body: JSON.stringify(data)
    })
      .then(response => {
        if (response.status == 200)
          resolve();
        else
          reject();
      }, reject);
  });
};

const deleteTable = table => {
  const endpoint = '/schemas/' + table;
  
  return new Promise((resolve, reject) => {
    Parse.Cloud.httpRequest({
      url: config.serverURL + endpoint,
      method: 'DELETE',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': config.appId,
        'X-Parse-Master-Key': config.masterKey
      }
    })
      .then(response => {
        if (response.status == 200)
          resolve();
        else
          reject();
      }, reject);
  });
};

const deleteContentItem = (user, tableName, itemId) => {
  let item;
  
  return new Parse.Query(tableName)
    .get(itemId, {useMasterKey: true})

    .then(p_item => {
      item = p_item;
      
      if (!checkRights(user, item))
        return Promise.reject("Access denied!");
      
      return getTableData(tableName);
    })
    
    .then(data => {
      for (let field in data.fields) {
        const val = data.fields[field];
        if (val.type == 'Pointer' && val.targetClass == 'MediaItem') {
          const media = item.get(field);
          //!! uncontrolled async operation
          if (media)
            media.destroy({useMasterKey: true});
        }
      }
    })
    
    .then(() => item.destroy({useMasterKey: true}));
};

const deleteModel = (user, model) => {
  if (!checkRights(user, model))
    return Promise.reject("Access denied!");
  
  let tableName;
  
  return getAllObjects(
    new Parse.Query('ModelField')
      .equalTo('model', model)
  )
    .then(fields => {
      const promises = [];
      for (let field of fields) {
        if (checkRights(user, field))
          promises.push(promisifyW(field.destroy({useMasterKey: true})));
      }
    
      return Promise.all(promises);
    })
    
    .catch(() => Promise.resolve())
  
    .then(() => {
      tableName = model.get('tableName');
      return getAllObjects(
        new Parse.Query(tableName));
    })
  
    .then(items => {
      const promises = [];
      for (let item of items) {
        promises.push(promisifyW(deleteContentItem(user, tableName, item.id)));
      }
    
      return Promise.all(promises);
    })
  
    .catch(() => Promise.resolve())
  
    .then(() => deleteTable(tableName))
  
    .catch(() => Promise.resolve())
  
    .then(() => model.destroy({useMasterKey: true}));
};


Parse.Cloud.define("deleteContentItem", request => {
  if (!request.user)
    throw 'Must be signed in to call this Cloud Function.';

  const {tableName, itemId} = request.params;
  if (!tableName || !itemId)
    throw 'There is no tableName or itemId params!';

  return deleteContentItem(request.user, tableName, itemId)
    .then(() => "Successfully deleted content item.")
    .catch(error => {
      throw `Could not delete content item: ${JSON.stringify(error, null, 2)}`;
    });
});

Parse.Cloud.define("deleteModel", request => {
  if (!request.user)
    throw 'Must be signed in to call this Cloud Function.';

  const {modelId} = request.params;
  if (!modelId)
    throw 'There is no modelId param!';

  return new Parse.Query("Model")
    .get(modelId, {useMasterKey: true})

    .then(model => deleteModel(request.user, model))
    
    .then(() => "Successfully deleted model.")
  
    .catch(error => {
      throw `Could not delete model: ${JSON.stringify(error, null, 2)}`;
    });
});

Parse.Cloud.define("deleteSite", request => {
  if (!request.user)
    throw 'Must be signed in to call this Cloud Function.';

  const {siteId} = request.params;
  if (!siteId)
    throw 'There is no siteId param!';

  let site;
  
  return new Parse.Query("Site")
    .get(siteId, {useMasterKey: true})

    .then(p_site => {
      site = p_site;
      
      if (!checkRights(request.user, site))
        return Promise.reject("Access denied!");
      
      return getAllObjects(
        new Parse.Query('Model')
          .equalTo('site', site));
    })
    
    .then(models => {
      const promises = [];
      for (let model of models)
        promises.push(promisifyW(
          deleteModel(request.user, model)
        ));
      
      return promises;
    })
    
    .then(() => {
      return getAllObjects(
        new Parse.Query('Collaboration')
          .equalTo('site', site));
    })
  
    .then(collabs => {
      const promises = [];
      for (let collab of collabs) {
        if (checkRights(request.user, collab))
          promises.push(promisifyW(collab.destroy({useMasterKey: true})));
      }
  
      return Promise.all(promises);
    })
  
    //.catch(() => Promise.resolve())
    
    .then(() => site.destroy({useMasterKey: true}))
  
    .then(() => "Successfully deleted site.")
  
    .catch(error => {
      throw `Could not delete site: ${JSON.stringify(error, null, 2)}`;
    });
});


const onCollaborationModify = (collab, deleting = false) => {
  const site = collab.get('site');
  const user = collab.get('user');
  const role = collab.get('role');
  
  let owner, collabACL;
  
  
  return site.fetch({useMasterKey: true})
    
    .then(() => {
      //ACL for collaborations
      owner = site.get('owner');
      
      collabACL = collab.getACL();
      if (!collabACL)
        collabACL = new Parse.ACL(owner);
      
      //getting all site collabs
      return getAllObjects(
        new Parse.Query('Collaboration')
          .equalTo('site', site));
    })
    
    .then(collabs => {
      if (!user)
        return;
      
      for (let tempCollab of collabs) {
        //set ACL for others collab
        let tempCollabACL = tempCollab.getACL();
        if (!tempCollabACL)
          tempCollabACL = new Parse.ACL(owner);
        
        if (collab.get('email') == user.get('email'))
          continue;
        
        tempCollabACL.setReadAccess(user, !deleting && role == ROLE_ADMIN);
        tempCollabACL.setWriteAccess(user, !deleting && role == ROLE_ADMIN);
        
        tempCollab.setACL(tempCollabACL);
        //!! uncontrolled async operation
        tempCollab.save(null, {useMasterKey: true});
        
        //set ACL for current collab
        if (!deleting) {
          const tempRole = tempCollab.get('role');
          const tempUser = tempCollab.get('user');
          collabACL.setReadAccess(tempUser, tempRole == ROLE_ADMIN);
          collabACL.setWriteAccess(tempUser, tempRole == ROLE_ADMIN);
        }
      }
      
      collabACL.setReadAccess(user, true);
      collabACL.setWriteAccess(user, true);
      collab.setACL(collabACL);
      //!! uncontrolled async operation
      collab.save(null, {useMasterKey: true});
    })
    
    .then(() => {
      if (!user)
        return;
      
      //ACL for site
      let siteACL = site.getACL();
      if (!siteACL)
        siteACL = new Parse.ACL(owner);
      
      siteACL.setReadAccess(user, !deleting);
      siteACL.setWriteAccess(user, !deleting && role == ROLE_ADMIN);
      site.setACL(siteACL);
      //!! uncontrolled async operation
      site.save(null, {useMasterKey: true});
  
      //ACL for media items
      return getAllObjects(
        new Parse.Query('MediaItem')
          .equalTo('site', site));
    })
  
    .then(mediaItems => {
      if (!user)
        return;
  
      for (let item of mediaItems) {
        let itemACL = item.getACL();
        if (!itemACL)
          itemACL = new Parse.ACL(owner);
  
        itemACL.setReadAccess(user, !deleting);
        itemACL.setWriteAccess(user, !deleting && role == ROLE_ADMIN);
        item.setACL(itemACL);
        //!! uncontrolled async operation
        item.save(null, {useMasterKey: true});
      }
      
      //ACL for models and content items
      return getAllObjects(
        new Parse.Query('Model')
          .equalTo('site', site));
    })
    
    .then(models => {
      if (!user)
        return;
      
      for (let model of models) {
        let modelACL = model.getACL();
        if (!modelACL)
          modelACL = new Parse.ACL(owner);
        
        modelACL.setReadAccess(user, !deleting);
        modelACL.setWriteAccess(user, !deleting && role == ROLE_ADMIN);
        model.setACL(modelACL);
        //!! uncontrolled async operation
        model.save(null, {useMasterKey: true});

        const tableName = model.get('tableName');
        //!! uncontrolled async operation
        getTableData(tableName)
          .then(response => {
            let CLP = response.classLevelPermissions;
            if (!CLP)
              CLP = {
                'get': {},
                'find': {},
                'create': {},
                'update': {},
                'delete': {},
                'addField': {}
              };
            
            if (!deleting) {
              CLP['get'][user.id] = true;
              CLP['find'][user.id] = true;
            } else {
              if (CLP['get'].hasOwnProperty(user.id))
                delete CLP['get'][user.id];
              if (CLP['find'].hasOwnProperty(user.id))
                delete CLP['find'][user.id];
            }
            
            if (!deleting && (role == ROLE_ADMIN || role == ROLE_EDITOR)) {
              CLP['create'][user.id] = true;
              CLP['update'][user.id] = true;
              CLP['delete'][user.id] = true;
            } else {
              if (CLP['create'].hasOwnProperty(user.id))
                delete CLP['create'][user.id];
              if (CLP['update'].hasOwnProperty(user.id))
                delete CLP['update'][user.id];
              if (CLP['delete'].hasOwnProperty(user.id))
                delete CLP['delete'][user.id];
            }
            
            if (!deleting && role == ROLE_ADMIN)
              CLP['addField'][user.id] = true;
            else if (CLP['addField'].hasOwnProperty(user.id))
              delete CLP['addField'][user.id];
            
            //!! uncontrolled async operation
            const data = {"classLevelPermissions": CLP};
            setTableData(tableName, data)
              .catch(() => setTableData(tableName, data, 'PUT'));
          });
      }
  
      return getAllObjects(
        new Parse.Query('ModelField')
          .containedIn('model', models));
    })
    
    .then(fields => {
      for (let field of fields) {
        let fieldACL = field.getACL();
        if (!fieldACL)
          fieldACL = new Parse.ACL(owner);
  
        fieldACL.setReadAccess(user, !deleting);
        fieldACL.setWriteAccess(user, !deleting && role == ROLE_ADMIN);
        field.setACL(fieldACL);
        //!! uncontrolled async operation
        field.save(null, {useMasterKey: true});
      }
    });
};


Parse.Cloud.define("onCollaborationModify", request => {
  if (!request.user)
    throw 'Must be signed in to call this Cloud Function.';

  const {collabId, deleting} = request.params;
  if (!collabId)
    throw 'There is no collabId param!';

  return new Parse.Query("Collaboration")
    .get(collabId, {useMasterKey: true})

    .then(collab => {
      if (!checkRights(request.user, collab))
        return Promise.reject("Access denied!");
      
      return onCollaborationModify(collab, deleting);
    })
    
    .then(() => 'ACL setup ends!');
});

Parse.Cloud.afterSave(Parse.User, request => {
  const user = request.object;
  
  return new Parse.Query('Collaboration')
    .equalTo('email', user.get('email'))
    
    .find({useMasterKey: true})
    
    .then(p_collabs => {
      const promises = [];

      for (let collab of p_collabs) {
        if (collab.get('user'))
          return Promise.reject('user also exists!');
  
        collab.set('user', user);
        
        promises.push(
          collab.save(null, {useMasterKey: true})
            .then(() => onCollaborationModify(collab))
        );
      }
      return Promise.all(promises);
    })
    
    .catch(() => Promise.resolve());
});

Parse.Cloud.define("onModelAdd", request => {
  if (!request.user)
    throw 'Must be signed in to call this Cloud Function.';

  const {modelId} = request.params;
  if (!modelId)
    throw 'There is no modelId param!';

  let model, site, owner, modelACL;
  
  return new Parse.Query("Model")
    .get(modelId, {useMasterKey: true})

    .then(p_model => {
      model = p_model;
      
      site = model.get('site');
      return site.fetch({useMasterKey: true});
    })
    
    .then(() => {
      //ACL for collaborations
      owner = site.get('owner');
      modelACL = new Parse.ACL(owner);
      
      return getAllObjects(
        new Parse.Query('Collaboration')
          .equalTo('site', site));
    })
    
    .then(collabs => {
      const admins = [owner.id];
      const writers = [owner.id];
      const all = [owner.id];
      
      for (let collab of collabs) {
        const user = collab.get('user');
        const role = collab.get('role');
  
        modelACL.setReadAccess(user, true);
        modelACL.setWriteAccess(user, role == ROLE_ADMIN);
  
        if (role == ROLE_ADMIN)
          admins.push(user.id);
        if (role == ROLE_ADMIN || role == ROLE_EDITOR)
          writers.push(user.id);
        all.push(user.id);
      }
  
      model.setACL(modelACL);
      //!! uncontrolled async operation
      model.save(null, {useMasterKey: true});
      
      //set CLP for content table
      const CLP = {
        'get': {},
        'find': {},
        'create': {},
        'update': {},
        'delete': {},
        'addField': {}
      };
      
      for (let user of all) {
        CLP['get'][user] = true;
        CLP['find'][user] = true;
      }
      for (let user of writers) {
        CLP['create'][user] = true;
        CLP['update'][user] = true;
        CLP['delete'][user] = true;
      }
      for (let user of admins) {
        CLP['addField'][user] = true;
      }
  
      const data = {"classLevelPermissions": CLP};
      return setTableData(model.get('tableName'), data);
    })
    
    .then(() => 'ACL setup ends!');
});

Parse.Cloud.define("onFieldAdd", request => {
  if (!request.user)
    throw 'Must be signed in to call this Cloud Function.';

  const {fieldId} = request.params;
  if (!fieldId)
    throw 'There is no fieldId param!';

  let field, model, site, owner, fieldACL;
  
  return new Parse.Query("ModelField")
    .get(fieldId, {useMasterKey: true})

    .then(p_field => {
      field = p_field;
  
      model = field.get('model');
      return model.fetch({useMasterKey: true});
    })

    .then(() => {
      site = model.get('site');
      return site.fetch({useMasterKey: true});
    })

    .then(() => {
      //ACL for collaborations
      owner = site.get('owner');
      fieldACL = new Parse.ACL(owner);
    
      return getAllObjects(
        new Parse.Query('Collaboration')
          .equalTo('site', site));
    })

    .then(collabs => {
      for (let collab of collabs) {
        const user = collab.get('user');
        const role = collab.get('role');
  
        fieldACL.setReadAccess(user, true);
        fieldACL.setWriteAccess(user, role == ROLE_ADMIN);
      }
    
      field.setACL(fieldACL);
      //!! uncontrolled async operation
      field.save(null, {useMasterKey: true});
    })
  
    .then(() => 'ACL setup ends!');
});

Parse.Cloud.define("onContentModify", request => {
  if (!request.user)
    throw 'Must be signed in to call this Cloud Function.';

  const {URL} = request.params;
  if (!URL)
    return 'Warning! There is no content hook!';

  return Parse.Cloud.httpRequest({
    URL,
    method: 'GET'
  })
    .then(response => {
      if (response.status == 200)
        return response.data;
      else
        throw response.status;
    });
});


Parse.Cloud.define("onMediaItemAdd", request => {
  if (!request.user)
    throw 'Must be signed in to call this Cloud Function.';

  const {itemId} = request.params;
  if (!itemId)
    throw 'There is no itemId param!';

  let item, site, itemACL;
  
  return new Parse.Query("MediaItem")
    .get(itemId, {useMasterKey: true})

    .then(p_item => {
      item = p_item;
      
      site = item.get('site');
      return site.fetch({useMasterKey: true});
    })
    
    .then(() => {
      //ACL for collaborations
      const owner = site.get('owner');
      itemACL = new Parse.ACL(owner);
      
      return getAllObjects(
        new Parse.Query('Collaboration')
          .equalTo('site', site));
    })
    
    .then(collabs => {
      for (let collab of collabs) {
        const user = collab.get('user');
        const role = collab.get('role');
  
        itemACL.setReadAccess(user, true);
        itemACL.setWriteAccess(user, role == ROLE_ADMIN);
      }
  
      item.setACL(itemACL);
      //!! uncontrolled async operation
      item.save(null, {useMasterKey: true});
    })
    
    .then(() => 'ACL setup ends!');
});


Parse.Cloud.define("inviteUser", request => {
  if (!request.user)
    throw 'Must be signed in to call this Cloud Function.';
  
  const {email, siteName} = request.params;
  if (!email || !siteName)
    throw 'Email or siteName is empty!';

  console.log(`Send invite to ${email} ${new Date()}`);
  
  const {AppCache} = require('parse-server/lib/cache');
  const emailAdapter = AppCache.get(config.appId)['userController']['adapter'];

  const emailSelf = request.user.get('email');
  const link = `${SITE}/sign?mode=register&email=${email}`;

  return emailAdapter.send({
    templateName: 'inviteEmail',
    recipient: email,
    variables: {siteName, emailSelf, link}
  })
    .then(() => {
      console.log(`Invite sent to ${email} ${new Date()}`);
      return "Invite email sent!";
    })
    .catch (error => {
      console.log(`Got an error in inviteUser: ${error}`);
      throw error;
    });
});

/*
const Mailgun = require('mailgun-js');
const mailgunConfig = configs.mailgunConfig;
const mailgun = new Mailgun(mailgunConfig);

Parse.Cloud.define("sendEmail", function(request, response) {
  console.log("sendEmail " + new Date());
  
  let data = {
    from:     mailgunConfig.fromAddress,
    to:       request.params.address,
    subject:  request.params.subject,
    html:     request.params.body
  };
  
  mailgun.messages().send(data, error => {
    if (error) {
      console.log("got an error in sendEmail: " + error);
      response.error(error);
    }	else {
      console.log("email sent to " + toEmail + " " + new Date());
      response.success("Email sent!");
    }
  });
});
*/

Parse.Cloud.define("checkPassword", request => {
  if (!request.user)
    throw 'Must be signed in to call this Cloud Function.';

  const {password} = request.params;
  if (!password)
    throw 'There is no password param!';

  const username = request.user.get('username');

  return Parse.User.logIn(username, password);
});