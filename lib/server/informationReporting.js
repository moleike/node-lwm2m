/*
 * Copyright 2014 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of lwm2m-node-lib
 *
 * lwm2m-node-lib is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * lwm2m-node-lib is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with lwm2m-node-lib.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */

'use strict';

var async = require('async');
var apply = async.apply;
var debug = require('debug')('lwm2m');
var objectValues = require('object.values');
var utils = require('../utils');
var content = require('../contentFormats');

function buildId(ep, path) {
  return ep + ':' + path;
}

/*!
 * Constructs an object representing the subscription for the changes in 
 * the value of a particular resource of a device.
 *
 * @param {Object} server
 * @param {String} ep
 * @param {String} path
 * @param {Object} observeStream        Stream object for writing into.
 * @param {Function} handler            Handler to be called each time a new piece of data arrives.
 * @returns {{id: string, resource: string, deviceId: *, stream: *, dataHandler: Function, finishHandler: Function}}
 * @constructor
 */
function ResourceListener(server, ep, path, observeStream, handler) {
  return {
    id: buildId(ep, path),
    resource: path,
    ep: ep,
    stream: observeStream,

    dataHandler: function (chunk) {
      debug('New data on resource %s in device [%s]', path, ep);
      handler(chunk.toString('utf8'), path, ep);
    },

    finishHandler: function(chunk) {
      debug('Finished observing value of resource %s in device [%s]', path, ep);
      delete server.subscriptions[this.id];
    }
  };
}

/**
 * Creates a subscription to a resource in a device, executing 
 * the given handler each time new data arrives to the server. As part of 
 * the the subscription process, the first piece of data will be 
 * automatically resolved in the same way as a Read action (returning the 
 * current resource data in the callback). Subsquent data will be processed
 * by the handler.
 *
 * @param {String} ep
 * @param {String} path
 * @param {Function} handler            Handler to be called each time a new piece of data arrives.
 */
exports.observe = function(ep, path, handler, callback) {
  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  var server = this;

  var processStream = function(err, stream) {
    if (err) {
      callback(err);
      return;
    }

    var id = buildId(ep, path);
    stream.pause();

    server.subscriptions[id] =
      new ResourceListener(server, ep, path, stream, handler);

    stream.on('data', function (chunk) {
      debug('Got first sample on path %s of device [%s]', path, ep);

      stream.removeAllListeners('data');
      stream.on('data', server.subscriptions[id].dataHandler);

      callback(null, chunk.toString('utf8'));
    });

    stream.on('finish', server.subscriptions[id].finishHandler);
    stream.resume();
  };

  debug('Observing value from resource %s in device [%s]', path, ep);

  this.sendRequest(ep, {
    method: 'GET',
    pathname: path,
    observe: true,
    options: {
      'Accept': content.text
    }
  }, processStream);
};

/**
 * Remove all the observations the server is currently performing.
 */
exports.cleanObservers = function(callback) {
  var server = this;

  Object.keys(server.subscriptions).forEach(function(id) {
    server.subscriptions[id].stream.close();
    delete server.subscriptions[id];
  });

  server.subscriptions = {};

  if (server._registry){
    server._registry.stopLifetimeCheck();
  }

  callback();
};

/**
 * Cancel an observation for the specified resource in a particular device.
 *
 * @param {Number} deviceId
 * @param {Number} objectType
 * @param {Number} objectId
 * @param {Number} resourceId
 */
exports.cancel = function(ep, path, callback) {
  var id = buildId(ep, path);

  this.subscriptions[id].stream.close();
  delete this.subscriptions[id];

  callback();
};
