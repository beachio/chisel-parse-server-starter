// Cloud Code entry point

Parse.Cloud.define("modifyUser", (request, response) => {
  if (!request.user) {
    response.error("Must be signed in to call this Cloud Function.");
    return;
  }
  if (request.user.get('role') != 'admin') {
    response.error("Not an Admin.");
    return;
  }
  
  Parse.Cloud.useMasterKey();
  
  let query = new Parse.Query(Parse.User);
  query.equalTo("username", request.params.username);
  
  // Get the first user which matches the above constraints.
  query.first({
    success: anotherUser => {
      for (let key in request.params.data)
        anotherUser.set(key, request.params.data[key]);
      
      // Save the user.
      anotherUser.save(null, {
        success: user => {
          response.success("Successfully updated user.");
        },
        error: (user, error) => {
          response.error("Could not save changes to user.");
        }
      });
    },
    error: error => {
      response.error("Could not find user.");
    }
  });
});

Parse.Cloud.define("deleteUser", (request, response) => {
  if (!request.user) {
    response.error("Must be signed in to call this Cloud Function.");
    return;
  }
  if (request.user.get('role') != 'admin') {
    response.error("Not an Admin.");
    return;
  }
  
  Parse.Cloud.useMasterKey();
  
  let query = new Parse.Query(Parse.User);
  query.equalTo("username", request.params.username);
  
  // Get the first user which matches the above constraints.
  query.first({
    success: anotherUser => {
      // Save the user.
      anotherUser.destroy({
        success: () => {
          response.success("Successfully deleted user.");
        },
        error: (user, error) => {
          response.error("Could not delete user.");
        }
      });
    },
    error: error => {
      response.error("Could not find user.");
    }
  });
});