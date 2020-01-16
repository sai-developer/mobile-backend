var promise = require('bluebird');
var fs = require("fs");
var config = require('config');

var options = {
  // Initialization Options
  promiseLib: promise
};

var pgp = require('pg-promise')(options);

var dbVariables = config.get('configVariables.dbConfig');
var dbUser = dbVariables.user;
var dbPassword = dbVariables.password;
var dbHost = dbVariables.host;
var dbPort = dbVariables.port;
var dbName = dbVariables.dbName;

console.log("SQL Config.....");
console.log(dbVariables);
var connectionString = 'postgres://'+dbUser+':'+dbPassword+'@'+dbHost+':'+dbPort+'/'+dbName;
var db = pgp(connectionString);

module.exports = db;
