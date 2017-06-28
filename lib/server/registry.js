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

var objectAssign = require('object.assign');
var findIndex = require('array.prototype.findindex');
var debug = require('debug')('lwm2m');
var errors = require('../errors');

module.exports = Registry;

function Registry() {
  this.clients = [];
}

Registry.prototype.register = function(client, callback) {
  return this._save(client, callback);
};

Registry.prototype.get = function(location, callback) {
  return this._get(location, callback);
};

Registry.prototype.find = function(endpoint, callback) {
  return this._find(endpoint, callback);
};

Registry.prototype.unregister = function(location, callback) {
  return this._delete(location, callback);
};

Registry.prototype.update = function(location, params, callback) {
  return this._update(location, params, callback);
};

Registry.prototype._find = function(endpoint, callback) {
  var location = this.clients.findIndex(function(elem) {
    return elem && elem.name === endpoint;
  });

  this._get(location, callback);
};

Registry.prototype._get = function(location, callback) {
  var result = this.clients[location];

  if (result) {
    callback(null, result);
  } else {
    callback(new errors.DeviceNotFound(location));
  }
};

Registry.prototype._delete = function(location, callback) {
  var result = this.clients[location];

  if (result) {
    clearTimeout(result.timeout);
    delete this.clients[location];
    callback(null, result);
  } else {
    callback(new errors.DeviceNotFound(location));
  }
};

Registry.prototype._save = function(client, callback) {
  var that = this;
  client.location = this.clients.length;

  var save = function(cb) {
    Object.defineProperty(client, 'timeout', {
      writable: true,
      value: setInterval(function() {
        if (!that.clients[client.location].updated) {
          that._delete(client.location, function(err) {
            debug('Client `%s` evicted', client.name);
          });
        } else {
          that.clients[client.location].updated = false;
        }
      }, client.lifetime * 1e3 * 2)
    });

    that.clients.push(client);
    return cb(null, client.location);
  };

  this._find(client.name, function(error, result){
    if (!error && result) {
      that._delete(result.location, function(err){
        return save(callback);
      });
    } else {
      return save(callback);
    }
  });
};

Registry.prototype._update = function(location, params, callback) {
  var result = this.clients[location];

  if (result) {
    this.clients[location] = Object.assign(result, params, {
      updated: true
    });

    callback(null, this.clients[location]);
  } else {
    callback(new errors.DeviceNotFound(location));
  }
};


