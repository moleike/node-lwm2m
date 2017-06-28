/*
 * Copyright 2017 Alexandre Moreno <alex_moreno@tutk.com>
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
var errors = require('../errors');
var utils = require('../utils');
var content = require('../contentFormats');
var debug = require('debug')('lwm2m');
var objectId = utils.objectId;
var Schema = require('../schema');

exports.handle = function(req, res, handler) {
  var queryParams = utils.extractQueryParams(req);
  var registry = this.getRegistry();

  function end(req, res) {
    return function (error, result) {
      if (error) {
        debug('Bootstrap request ended up in error [%s] with code [%s]', 
          error.name, error.code);

        res.code = error.code;
        res.end(error.name);
      } else {
        debug('Client [%s] initiated bootstrap successfully', 
          queryParams.ep);

        res.code = '2.04';
        res.end('');
      }
    };
  }

  debug('Handling bootstrap request');

  var client = {
    name : queryParams.ep,
    address: req.rsinfo.address,
    port: req.rsinfo.port,
    lifetime: 30 // it will vanish in 30 sec.
  };

  async.series([
    async.apply(utils.checkMandatoryQueryParams, ['ep'], queryParams),
    registry.register.bind(registry, client),
    async.apply(handler, queryParams)
  ], end(req, res));
};

/**
 * Makes a Write operation over the designed resource ID of the selected device.
 */
exports.write = function(ep, path, value, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  var mediaType = utils.getMediaType(path, value, options.format);
  var payload;
  var schema = options.schema;

  if (typeof value === 'object') { // object --> schema
    if (!schema) {
      schema = this._schemas['/' + objectId(path)]
    }

    if (!(schema instanceof Schema)) {
      throw new TypeError('Illegal schema');
    }

    try {
      payload = utils.generatePayload(value, schema, mediaType);
    } catch (e) {
      if (callback) {
        debug('something is terribly wrong', e);
        callback(e);
      } else {
        return Promise.reject(e);
      }
    }
  } else {
    if (!Buffer.isBuffer(value)) {
      payload = String(value);
    } else {
      payload = value;
    }
  }

  var processResponse = function(res) {
    return new Promise(function(resolve, reject) {
      if (res.code === '2.04') {
        resolve();
      } else {
        reject(new errors.ClientError(res.code));
      }
    });
  };

  debug('Writing to %s in device [%s]', path, ep);

  var promise = this._request(ep, { 
    method: 'PUT',
    pathname: path,
    payload: payload,
    options: {
      'Content-Format': mediaType
    }
  }).then(processResponse) 

  if (callback) {
    promise.then(callback.bind(null, null), callback);
  }

  return promise;
};

exports.remove = function(ep, path, callback) { 
  var processResponse = function(res) {
    return new Promise(function(resolve, reject) {
      if (res.code === '2.02') {
        resolve();
      } else {
        reject(new errors.ClientError(res.code));
      }
    });
  };

  debug('Deleting object %s in device [%s]', path, ep);

  var promise = this._request(ep, { 
    method: 'DELETE',
    pathname: path
  }).then(processResponse); 

  if (callback) {
    promise.then(callback.bind(null, null), callback);
  }

  return promise;
};

exports.finish = function(ep, callback) { 
  var processResponse = function(res) {
    return new Promise(function(resolve, reject) {
      if (res.code === '2.04') {
        resolve(res.payload.toString('utf8'));
      } else {
        reject(new errors.ClientError(res.code));
      }
    });
  };

  debug('Bootstrap finish request on device [%s]', ep);

  var promise = this._request(ep, { 
    method: 'POST',
    pathname: '/bs'
  }).then(processResponse); 

  if (callback) {
    promise.then(callback.bind(null, null), callback);
  }

  return promise;
};
