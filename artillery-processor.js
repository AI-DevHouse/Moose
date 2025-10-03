// Artillery processor for custom logic and reporting

module.exports = {
  // Custom functions can be added here
  logResponse: function(requestParams, response, context, ee, next) {
    if (response.statusCode >= 400) {
      console.log(`ERROR: ${requestParams.url} returned ${response.statusCode}`);
    }
    return next();
  }
};
