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