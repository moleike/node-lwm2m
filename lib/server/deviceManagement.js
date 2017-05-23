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

var async = require('async'),
    apply = async.apply,
    errors = require('../errors'),
    senml = require('../senml'),
    tlv = require('../tlv'),
    getMediaType = require('../mediaType').getMediaType,
    content = require('../contentFormats'),
    debug = require('debug')('lwm2m'),
    coapUtils = require('../coapUtils');

function objectId(path) {
  return path
    .split('/')
    .filter(Boolean)[0];
}

/**
 * Execute a read operation for the selected resource, identified following the LWTM2M conventions by its: deviceId,
 * objectId, instanceId and resourceId.
 */
function read(deviceId, path, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var opts = options || { };
  var schema = opts.schema || this._schemas['/' + objectId(path)];
  var registry = this.getRegistry();

  function createRequest(device, callback) {
    var request = {
      host: device.address,
      port: device.port,
      method: 'GET',
      pathname: path
    };

    callback(null, request);
  }


  function processResponse(res, callback) {
    if (res.code === '2.05') {
      try {
        var body = coapUtils.parsePayload(res, schema);
        callback(null, body);
      } catch (err) {
        callback(err);
      }
    } else if (res.code === '4.04') {
      callback(new errors.ResourceNotFound());
    } else {
      callback(new errors.ClientError(res.code));
    }
  }

  debug('Reading value from %s in device [%d]', path, deviceId);

  async.waterfall([
    apply(registry.get, deviceId),
    createRequest,
    this.send.bind(this),
    processResponse,
  ], callback);
}

/**
 * Makes a Write operation over the designed resource ID of the selected device.
 */
function write(deviceId, path, value, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var mediaType, payload;
  var schema = options.schema || this._schemas['/' + objectId(path)];
  var registry = this.getRegistry();

  try {
    mediaType = getMediaType(path, value, options.format);
  } catch (e) {
    callback(e);
  }

  if (typeof value === 'object') { // object --> schema
    try {
      if (!schema) {
        throw new Error('missing schema');
      }

      switch (mediaType) {
        case content.json:
          payload = senml.serialize(value, schema);
          break;
        case content.tlv:
          payload = tlv.serialize(value, schema);
          break;
      }
    } catch (e) {
      callback(e);
    }
  } else {
    payload = value;
  }

  function createRequest(device, callback) {
    var request = {
      host: device.address,
      port: device.port,
      method: 'POST',
      pathname: path,
      payload: payload,
      options: {
        'Content-Format': mediaType
      }
    };

    callback(null, request);
  }

  function processResponse(res, callback) {
    if (res.code === '2.04') {
      callback(null, res.payload.toString('utf8'));
    } else if (res.code === '4.04') {
      callback(new errors.ObjectNotFound(path));
    } else {
      callback(new errors.ClientError(res.code));
    }
  }

  debug('Writting a new value on path %s in device [%d]', 
    path, deviceId);

  async.waterfall([
    apply(registry.get, deviceId),
    createRequest,
    this.send.bind(this),
    processResponse
  ], callback);
}

/**
 * Makes an Execute operation over the designed resource ID of the selected device.
 */
function execute(deviceId, path, value, callback) {
  function createRequest(device, callback) {
    var request = {
      host: device.address,
      port: device.port,
      method: 'POST',
      pathname: path,
      payload: value,
      options: {
        'Content-Format': content.text
      }
    };

    callback(null, request);
  }

  function processResponse(res, callback) {
    if (res.code === '2.04') {
      callback(null, res.payload.toString('utf8'));
    } else if (res.code === '4.04') {
      callback(new errors.ObjectNotFound(path));
    } else {
      callback(new errors.ClientError(res.code));
    }
  }

  debug('Executing resource %s in device [%d]', path, deviceId);

  var registry = this.getRegistry();

  async.waterfall([
    apply(registry.get, deviceId),
    createRequest,
    this.send.bind(this),
    processResponse
  ], callback);
}

/**
 * Write the attributes given as a parameter in the remote resource identified by the Object type and id in the
 * selected device.
 *
 * @param {String} deviceId             ID of the device that holds the resource.
 * @param {String} objectId           ID of the object type of the instance.
 * @param {String} instanceId             ID of the instance whose resource will be modified.
 * @param {String} resourceId           ID of the resource to modify.
 * @param {Object} parameters           Object with the parameters to write: each parameter is stored as an attribute.
 */
function writeAttributes(deviceId, path, attributes, callback) {
  function createQueryParams(innerCb) {
    var validAttributes = ['pmin', 'pmax', 'gt', 'lt', 'st', 'cancel'],
        result = [],
        errorList = [];

    for (var i in attributes) {
      if (attributes.hasOwnProperty(i)) {
        if (validAttributes.indexOf(i) >= 0) {
          result.push(i + '=' + attributes[i]);
        } else {
          errorList.push(i);
        }
      }
    }

    result = result.join('&');

    if (errorList.length !== 0) {
      innerCb(new errors.UnsupportedAttributes(errorList));
    } else {
      innerCb(null, result);
    }
  }

  function createWriteAttributesRequest(data, innerCb) {
    var request = {
      host: data[0].address,
      port: data[0].port,
      pathname: path,
      method: 'PUT',
      query: data[1]
    };

    innerCb(null, request);
  }

  function processResponse(res, callback) {
    if (res.code === '2.04') {
      callback(null, res.payload.toString('utf8'));
    } else if (res.code === '4.04') {
      callback(new errors.ObjectNotFound(path));
    } else {
      callback(new errors.ClientError(res.code));
    }
  }

  debug('Writting new discover attributes on resource %s in device [%d]',
    path, deviceId);
  debug('The new attributes are:\n%j', attributes);

  var registry = this.getRegistry();

  async.waterfall([
    apply(async.parallel, [
      apply(registry.get, deviceId),
      createQueryParams
    ]),
    createWriteAttributesRequest,
    this.send.bind(this),
    processResponse
  ], callback);
}

/**
 * Execute a discover operation for the selected resource, identified following the LWTM2M conventions by its:
 * deviceId, objectId, instanceId and resourceId.
 */
function discover(deviceId, path, callback) {
  function createRequest(device, callback) {
    var request = {
      host: device.address,
      port: device.port,
      method: 'GET',
      pathname: path,
      options: {
          'Accept': 'application/link-format'
      }
    };

    callback(null, request);
  }

  function processResponse(res, callback) {
    if (res.code === '2.05') {
      callback(null, res.payload.toString('utf8'));
    } else if (res.code === '4.04') {
      callback(new errors.ObjectNotFound(path));
    } else {
      callback(new errors.ClientError(res.code));
    }
  }

  debug('Executing a discover operation on path %s in device [%d]',
    path, deviceId);

  var registry = this.getRegistry();

  async.waterfall([
    apply(registry.get, deviceId),
    createRequest,
    this.send.bind(this),
  ], callback);
}

function create(deviceId, path, value, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var mediaType = getMediaType(path, value, options.format);
  var payload;

  if (typeof value === 'object') { // object --> schema
    try {
      switch(mediaType) {
        case content.json:
          payload = senml.serialize(value, options.schema);
          break;
        case content.tlv:
          payload = tlv.serialize(value, options.schema);
          break;
      }
    } catch (e) {
      callback(e);
    }
  } else {
    payload = value;
  }

  function createRequest(device, callback) {
    var request = {
      host: device.address,
      port: device.port,
      method: 'POST',
      pathname: path,
      payload: payload
    };

    callback(null, request);
  }

  function processResponse(res, callback) {
    if (res.code === '2.01') {
      callback(null);
    } else if (res.code === '4.04') {
      callback(new errors.ObjectNotFound(path));
    } else {
      callback(new errors.ClientError(res.code));
    }
  }

  debug('Creating a new Object Instance in %s', path);

  var registry = this.getRegistry();

  async.waterfall([
    apply(registry.get, deviceId),
    createRequest,
    this.send.bind(this),
  ], callback);
}

function remove(deviceId, path, callback) {
  function createRequest(device, callback) {
    var request = {
      host: device.address,
      port: device.port,
      method: 'DELETE',
      pathname: path
    };

    callback(null, request);
  }

  function processResponse(res, callback) {
    if (res.code === '2.02') {
      callback(null);
    } else if (res.code === '4.04') {
      callback(new errors.ObjectNotFound(path));
    } else {
      callback(new errors.ClientError(res.code));
    }
  }

  debug('Delete Object Instance in %s', path);

  var registry = this.getRegistry();

  async.waterfall([
    apply(registry.get, deviceId),
    createRequest,
    this.send.bind(this),
  ], callback);
}

exports.read = read;
exports.write = write;
exports.execute = execute;
exports.writeAttributes = writeAttributes;
exports.discover = discover;
exports.create = create;
exports.remove = remove;
