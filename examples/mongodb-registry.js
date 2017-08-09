'use strict';

var Registry = require('..').Registry
  , MongoClient = require('mongodb').MongoClient
  , ObjectId = require('mongodb').ObjectId
  , errors = require('../lib/errors');

function MongoRegistry(url) {
  Registry.call(this);

  var _this = this;
  MongoClient.connect(url, function(err, db) {
    if (err) {
      _this.emit('error', err); // FIXME server should check this
      db.close();
    } else {
      _this.clients = db.collection('clients');
    }
  });
}

module.exports = MongoRegistry;
MongoRegistry.prototype = Object.create(Registry.prototype);
MongoRegistry.prototype.constructor = MongoRegistry;

MongoRegistry.prototype._find = function(endpoint, callback) {
  this.clients.find({ ep: endpoint }).limit(1).next(function(err, result) {
    if (err) {
      callback(err);
    } else if (result === null) {
      callback(new errors.DeviceNotFound());
    } else {
      callback(null, Object.assign({ location: result._id }, result));
    }
  });
};

MongoRegistry.prototype._get = function(location, callback) {
  this.clients.find({ _id: ObjectId(location) })
    .limit(1).next(function(err, result) {
      if (err) {
        callback(err);
      } else if (result === null) {
        callback(new errors.DeviceNotFound());
      } else {
        callback(null, Object.assign({ location: result._id }, result));
      }
    });
};

MongoRegistry.prototype._save = function(client, callback) {
  this.clients.insertOne(client, function(err, result) {
    if (err) {
      callback(err);
    } else {
      callback(null, result.insertedId);
    }
  });
};

MongoRegistry.prototype._update = function(location, params, callback) {
  this.clients.findOneAndUpdate({ 
    _id: ObjectId(location), 
  }, { 
    $set: params, 
  }, function(err, result) {
    if (err) {
      callback(err);
    } else if (result.value === null) {
      callback(new errors.DeviceNotFound());
    } else {
      callback(null, result.value._id);
    }
  });
};

MongoRegistry.prototype._delete = function(location, callback) {
  this.clients.findOneAndDelete({ 
    _id: ObjectId(location), 
  }, function(err, result) {
    if (err) {
      callback(err);
    } else if (result.value === null) {
      callback(new errors.DeviceNotFound());
    } else {
      callback(null, result.value);
    }
  });
};


