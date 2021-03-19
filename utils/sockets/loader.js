module.exports = function(socket, page, browser) {
  require('./authorizeInSteam.js')(socket, page, browser);
  require('./startParsing.js')(socket, page, browser);
}