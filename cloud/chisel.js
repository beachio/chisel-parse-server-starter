let promisify = pp => {
  return new Promise((rs, rj) => pp.then(rs, rj));
};

let promisifyW = pp => {
  return new Promise((rs, rj) => pp.then(rs, rs));
};

let checkRights = (user, obj) => {
  let acl = obj.getACL();
  if (!acl)
    return true;
  
  let read = acl.getReadAccess(user.id);
  let write = acl.getWriteAccess(user.id);
  
  let pRead = acl.getPublicReadAccess();
  let pWrite = acl.getPublicWriteAccess();
  
  return read && write || pRead && pWrite;
};


let deleteModel = (user, model) => {
  if (!checkRights(user, model))
    return Promise.reject("Access denied!");
  
  return promisify(
    new Parse.Query('ModelField')
      .equalTo('model', model)
      .find()
  )
    .then(fields => {
      let promises = [];
      for (let field of fields) {
        if (checkRights(user, field))
          promises.push(promisifyW(field.destroy()));
      }
    
      return Promise.all(promises);
    })
    
    .catch(() => Promise.resolve())
  
    .then(() => {
      //TODO: clearing all content, not first 100
      let tableName = model.get('tableName');
      return promisify(
        new Parse.Query(tableName)
          .find());
    })
  
    .then(items => {
      let promises = [];
      for (let item of items) {
        if (checkRights(user, item))
          promises.push(promisifyW(item.destroy()));
      }
    
      return Promise.all(promises);
    })
  
    .catch(() => Promise.resolve())
  
    .then(() => promisify(model.destroy()));
};


Parse.Cloud.define("deleteModel", (request, response) => {
  if (!request.user) {
    response.error("Must be signed in to call this Cloud Function.");
    return;
  }
  
  Parse.Cloud.useMasterKey();
  
  promisify(
    new Parse.Query("Model")
      .get(request.params.modelId)
  )
    .then(model => deleteModel(request.user, model))
    
    .then(() => response.success("Successfully deleted model."))
  
    .catch(error => response.error("Could not delete model: " + JSON.stringify(error, null, 2)));
});


Parse.Cloud.define("deleteSite", (request, response) => {
  if (!request.user) {
    response.error("Must be signed in to call this Cloud Function.");
    return;
  }
  
  Parse.Cloud.useMasterKey();
  
  let site;
  
  promisify(
    new Parse.Query("Site")
      .get(request.params.siteId)
  )
    .then(p_site => {
      site = p_site;
      
      if (!checkRights(request.user, site))
        return Promise.reject("Access denied!");
      
      return promisify(
        new Parse.Query('Model')
          .equalTo('site', site)
          .find());
    })
    
    .then(models => {
      let promises = [];
      for (let model of models)
        promises.push(promisifyW(deleteModel(request.user, model)));
      
      return promises;
    })
    
    .then(() => {
      return promisify(
        new Parse.Query('Collaboration')
          .equalTo('site', site)
          .find());
    })
  
    .then(collabs => {
      let promises = [];
      for (let collab of collabs) {
        if (checkRights(request.user, collab))
          promises.push(promisifyW(collab.destroy()));
      }
  
      return Promise.all(promises);
    })
  
    .catch(() => Promise.resolve())
    
    .then(() => promisify(site.destroy()))
  
    .then(() => response.success("Successfully deleted site."))
  
    .catch(error => response.error("Could not delete site: " + JSON.stringify(error, null, 2)));
});


const ROLE_ADMIN = "ADMIN";

Parse.Cloud.define("onCollaborationModify", (request, response) => {
  if (!request.user) {
    response.error('You must be authorized!');
    return;
  }
   
  Parse.Cloud.useMasterKey();
  
  let deleting = request.params.deleting;
  
  let collab, site, user, role, owner, collabACL;
  
  promisify(
    new Parse.Query("Collaboration")
      .get(request.params.collabId)
  )
    .then(p_collab => {
      collab = p_collab;
      
      site = collab.get('site');
      user = collab.get('user');
      role = collab.get('role');
      
      return promisify(site.fetch());
    })
  
    .then(() => {
      //ACL for collaborations
      owner = site.get('owner');
      
      collabACL = collab.getACL();
      if (!collabACL)
        collabACL = new Parse.ACL(owner);
      
      return promisify(
        new Parse.Query('Collaboration')
          .equalTo('site', site)
          .find());
    })
    
    .then(collabs => {
      for (let tempCollab of collabs) {
        //set ACL for others collab
        let tempCollabACL = tempCollab.getACL();
        if (!tempCollabACL)
          tempCollabACL = new Parse.ACL(owner);
  
        let tempUser = tempCollab.get('user');
        if (tempUser == user)
          continue;
    
        tempCollabACL.setReadAccess(user, !deleting && role == ROLE_ADMIN);
        tempCollabACL.setWriteAccess(user, !deleting && role == ROLE_ADMIN);
    
        tempCollab.setACL(tempCollabACL);
        tempCollab.save();
    
        //set ACL for current collab
        if (!deleting) {
          let tempRole = tempCollab.get('role');
          collabACL.setReadAccess(tempUser, tempRole == ROLE_ADMIN);
          collabACL.setWriteAccess(tempUser, tempRole == ROLE_ADMIN);
        }
      }
  
      if (!deleting) {
        collabACL.setReadAccess(user, true);
        collabACL.setWriteAccess(user, true);
        collab.setACL(collabACL);
        collab.save();
      }
    })
    
    .then(() => {
      //ACL for site
      let siteACL = site.getACL();
      if (!siteACL)
        siteACL = new Parse.ACL(owner);
  
      siteACL.setReadAccess(user, !deleting);
      siteACL.setWriteAccess(user, !deleting && role == ROLE_ADMIN);
      site.setACL(siteACL);
      site.save();
  
      //ACL for models and content items
  
      return promisify(
        new Parse.Query('Model')
          .equalTo('site', site)
          .find());
    })
    
    .then(models => {
      for (let model of models) {
        let modelACL = model.getACL();
        if (!modelACL)
          modelACL = new Parse.ACL(owner);
    
        modelACL.setReadAccess(user, !deleting);
        modelACL.setWriteAccess(user, !deleting && role == ROLE_ADMIN);
        model.setACL(modelACL);
        model.save();
    
        /*
         let Content = Parse.Object.extend(model.tableName);
         let contentACL = Content.getACL();
         contentACL.setReadAccess(collab.user.origin, !deleting);
         contentACL.setWriteAccess(collab.user.origin, !deleting && (collab.role == ROLE_ADMIN || collab.role == ROLE_DEVELOPER));
         Content.setACL(contentACL);
         Content.save();
         */
      }
    })
    
    .then(() => response.success('ACL setup ends!'))
    
    .catch(e => response.error(e));
});


Parse.Cloud.define("onModelAdd", (request, response) => {
  if (!request.user) {
    response.error('You must be authorized!');
    return;
  }
  
  Parse.Cloud.useMasterKey();
  
  let model, site, owner, modelACL;
  
  promisify(
    new Parse.Query("Model")
      .get(request.params.modelId)
  )
    .then(p_model => {
      model = p_model;
      
      site = model.get('site');
      return promisify(site.fetch());
    })
    
    .then(() => {
      //ACL for collaborations
      owner = site.get('owner');
      modelACL = new Parse.ACL(owner);
      
      return promisify(
        new Parse.Query('Collaboration')
          .equalTo('site', site)
          .find());
    })
    
    .then(collabs => {
      for (let collab of collabs) {
        let user = collab.get('user');
        let role = collab.get('role');
  
        modelACL.setReadAccess(user, true);
        modelACL.setWriteAccess(user, role == ROLE_ADMIN);
      }
  
      model.setACL(modelACL);
      model.save();
    })
    
    .then(() => {
      /*
       let Content = Parse.Object.extend(model.tableName);
       let contentACL = Content.getACL();
       contentACL.setReadAccess(collab.user.origin, !deleting);
       contentACL.setWriteAccess(collab.user.origin, !deleting && (collab.role == ROLE_ADMIN || collab.role == ROLE_DEVELOPER));
       Content.setACL(contentACL);
       Content.save();
       */
    })
    
    .then(() => response.success('ACL setup ends!'))
    
    .catch(e => response.error(e));
});