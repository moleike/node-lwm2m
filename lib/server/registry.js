/*
 * Copyright 2017 Alexandre Moreno <alex_moreno@tutk.com>
 *
 * This file is part of node-lwm2m
 *
 * node-lwm2m is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * node-lwm2m is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with node-lwm2m.
 * If not, see http://www.gnu.org/licenses/.
 *
 */

'use strict';

var debug = require('debug')('lwm2m');
var errors = require('../errors');
var utils = require('../utils');
var updated = Symbol();
var EventEmitter = require('events').EventEmitter;

/**
 * Registry for clients. 
 * Default implementation is in-memory.
 *
 * For production use, extend `Registry` class and 
 * give new implementations to
 * _get, _find, _save, _update and _delete.
 *
 * @constructor
 * @augments EventEmitter
 */
function Registry() {
  EventEmitter.call(this);

  if (this.constructor === Registry) {
    this.clients = [];
  }
}

module.exports = Registry;
Registry.prototype = Object.create(EventEmitter.prototype);
Registry.prototype.constructor = Registry;

/**
 * get client by endpoint name
 * @param {string} endpoint
 * @param {Function} callback - callback is given
 * the two arguments `(err, client)`
 */
Registry.prototype._find = function(endpoint, callback) {
  var location = this.clients.findIndex(function(elem) {
    return elem && elem.ep === endpoint;
  });

  this._get(location, callback);
};

Registry.prototype.find = function(endpoint) {
  return utils.promisify(this._find.bind(this))(endpoint);
};

/**
 * get client by location in the registry
 * @param {string} location
 * @param {Function} callback - callback is given
 * the two arguments `(err, client)`
 */
Registry.prototype._get = function(location, callback) {
  var result = this.clients[location];

  if (result) {
    callback(null, result);
  } else {
    callback(new errors.DeviceNotFound());
  }
};

Registry.prototype.get = function(location) {
  return utils.promisify(this._get.bind(this))(location);
};

/**
 * store a new client in the registry
 * @param {Object} client
 * @param {Function} callback - callback is given
 * the two arguments `(err, location)`
 */
Registry.prototype._save = function(client, callback) {
  var location = this.clients.findIndex(Object.is.bind(null, undefined));

  if (location < 0)
    location = this.clients.length;

  var obj = Object.assign({ 
    lt: 86400,
    location: location,
  }, client);

  var that = this;

  Object.defineProperty(obj, 'timeout', {
    value: setInterval(function() {
      if (!that.clients[location][updated]) {
        that._delete(location, function(err) {
          debug(err);
        });
      } else {
        that.clients[location][updated] = false;
      }
    }, obj.lt),
  });

  this.clients[location] = obj;
  return callback(null, location);

};

Registry.prototype.save = function(client) {
  return utils.promisify(this._save.bind(this))(client);
};

/**
 * update a client in the registry
 * @param {string} location
 * @param {Object} params
 * @param {Function} callback - callback is given
 * the two arguments `(err, location)`
 */
Registry.prototype._update = function(location, params, callback) {
  var result = this.clients[location];

  if (result) {
    this.clients[location] = Object.assign(result, params);
    this.clients[location][updated] = true;

    callback(null, location);
  } else {
    callback(new errors.DeviceNotFound());
  }
};

Registry.prototype.update = function(location, params) {
  var _this = this;

  return new Promise(function(resolve, reject) {
    _this._update(location, params, function(err, location) {
      if (err) {
        reject(err);
      } else {
        _this.emit('update', location);
        resolve(location);
      }
    });
  });
};

/**
 * delete client from the registry
 * @param {string} location
 * @param {Function} callback - callback is given
 * the two arguments `(err, client)`
 */
Registry.prototype._delete = function(location, callback) {
  var result = this.clients[location];

  if (result) {
    clearTimeout(result.timeout);
    delete this.clients[location];
    callback(null, result);
  } else {
    callback(new errors.DeviceNotFound());
  }
};

Registry.prototype.unregister = function(location) {
  var _this = this;

  return new Promise(function(resolve, reject) {
    _this._delete(location, function(err, result) {
      if (err) {
        reject(err);
      } else {
        _this.emit('deregister', location);
        resolve(result);
      }
    });
  });
};

Registry.prototype.register = function(client) {
  var that = this;

  if (!client.ep)
    return Promise.reject(new Error('missing `ep` parameter'));

  return this.find(client.ep)
    .then(function(result) {
      return that.update(result.location, client);
    })
    .catch(function(err) {
      if (err instanceof errors.DeviceNotFound) {
        return that.save(client);
      } else {
        return Promise.reject(err);
      }
    });
};



