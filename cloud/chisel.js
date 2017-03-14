let promisify = pp => {
  return new Promise((rs, rj) => pp.then(rs, rj));
};

Parse.Cloud.define("deleteModel", (request, response) => {
  if (!request.user) {
    response.error("Must be signed in to call this Cloud Function.");
    return;
  }
  
  Parse.Cloud.useMasterKey();
  
  let model;
  
  let checkRights = obj => {
    let acl = obj.getACL();
    if (!acl)
      return true;
    
    let read = acl.getReadAccess(request.user.id);
    let write = acl.getWriteAccess(request.user.id);
    
    let pRead = acl.getPublicReadAccess();
    let pWrite = acl.getPublicWriteAccess();
    
    return read && write || pRead && pWrite;
  };
  
  
  promisify(
    new Parse.Query("Model")
      .get(request.params.modelId)
  )
    .then(p_model => {
      model = p_model;
      
      if (!checkRights(model))
        return Promise.reject("Acces denied!");
  
      return promisify(
        new Parse.Query('ModelField')
          .equalTo('model', model)
          .find());
    })
    
    .then(fields => {
      let promises = [];
      for (let field of fields) {
        if (checkRights(field))
          promises.push(promisify(field.destroy()));
      }
      
      return Promise.all(promises);
    })
    
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
        if (checkRights(item))
          promises.push(promisify(item.destroy()));
      }
    
      return Promise.all(promises);
    })
    
    .then(() => promisify(model.destroy()))
    
    .then(() => response.success("Successfully deleted model."))
  
    .catch(error => response.error("Could not delete model: " + JSON.stringify(error, null, 2)));
  });