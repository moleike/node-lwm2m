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
      _this.clients.createIndex({ expires: 1 }, { expireAfterSeconds: 30 });
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

MongoRegistry.prototype._save = function(params, callback) {
  var client = Object.assign({
    expires: new Date(Date.now() + (params.lt || 86400) * 1e3),
  }, params);

  this.clients.insertOne(client, function(err, result) {
    if (err) {
      callback(err);
    } else {
      callback(null, result.insertedId);
    }
  });
};

MongoRegistry.prototype._update = function(location, params, callback) {
  var _this = this;

  this.get(location)
    .then(function(result) {
      var client = Object.assign(result, params, {
        expires: new Date(Date.now() + (params.lt || result.lt) * 1e3),
      });

      return _this.clients.updateOne({ 
        _id: ObjectId(location), 
      }, { 
        $set: client,
      });
    })
    .then(function() {
      callback(null, location);
    })
    .catch(callback);
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


