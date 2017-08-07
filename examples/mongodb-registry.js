'use strict';

var Registry = require('..').Registry
  , MongoClient = require('mongodb').MongoClient;

function MongoRegistry(url) {
  Registry.call(this);

  var _this = this;
  MongoClient.connect(url, function(err, db) {
    if (err) {
      _this.emit('error', err);
      db.close();
    } else {
      _this.clients = db.collection('clients');
    }
  });
}

module.exports = MongoRegistry;
  

MongoRegistry.prototype = Object.create(Registry.prototype);
MongoRegistry.prototype.constructor = MongoRegistry;

MongoRegistry.prototype._save = function(client, callback) {
  this.clients.insertOne(client, function(err, result) {
    if (err) {
      callback(err);
    } else {
      callback(null, result.insertedId);
    }
  });
};

MongoRegistry.prototype._find = function(endpoint, callback) {
  this.clients.findOne({ ep: endpoint }, callback);
};


