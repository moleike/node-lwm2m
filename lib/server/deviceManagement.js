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

var errors = require('../errors');
var senml = require('../senml');
var tlv = require('../tlv');
var content = require('../contentFormats');
var debug = require('debug')('lwm2m');
var utils = require('../utils');
var validate = require('../schema').validate;
var objectId = utils.objectId;
var objectValues = require('object.values');

/**
 * Execute a read operation for the selected resource, identified following the LWTM2M conventions by its: ep,
 * objectId, instanceId and resourceId.
 */
function read(ep, path, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var opts = options || { };
  var schema = opts.schema || this._schemas['/' + objectId(path)];

  function processResponse(err, res) {
    if (err) {
      callback(err);
      return;
    }

    if (res.code === '2.05') {
      try {
        var body = utils.parsePayload(res, schema);

        if (utils.isResource(path)) {
          body = objectValues(body).pop();
        }

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

  debug('Reading value from %s in device [%s]', path, ep);

  this.sendRequest(ep, {
    method: 'GET',
    pathname: path
  }, processResponse);
}

/**
 * Makes a Write operation over the designed resource ID of the selected device.
 */
function write(ep, path, value, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var method = utils.isResource(path) ? 'PUT' : 'POST';
  var schema = options.schema || this._schemas['/' + objectId(path)];
  var mediaType = utils.getMediaType(path, value, options.format);
  var payload;

  if (typeof value === 'object') { // object --> schema
    try {
      if (!schema) {
        throw new Error('missing schema');
      }

      validate(value, schema);

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
    // FIXME we are not validating here
    payload = value;
  }

  function processResponse(err, res) {
    if (err) {
      callback(err);
      return;
    }

    if (res.code === '2.04') {
      callback(null, res.payload.toString('utf8'));
    } else if (res.code === '4.04') {
      callback(new errors.ObjectNotFound(path));
    } else {
      callback(new errors.ClientError(res.code));
    }
  }

  debug('Writting a new value on path %s in device [%s]', 
    path, ep);

  this.sendRequest(ep, {
    method: method,
    pathname: path,
    payload: payload,
    options: {
      'Content-Format': mediaType
    }
  }, processResponse);
}

/**
 * Makes an Execute operation over the designed resource ID of the selected device.
 */
function execute(ep, path, value, callback) {
  function processResponse(err, res) {
    if (err) {
      callback(err);
      return;
    }

    if (res.code === '2.04') {
      callback(null, res.payload.toString('utf8'));
    } else if (res.code === '4.04') {
      callback(new errors.ObjectNotFound(path));
    } else {
      callback(new errors.ClientError(res.code));
    }
  }

  debug('Executing resource %s in device [%s]', path, ep);

  this.sendRequest(ep, {
    method: 'POST',
    pathname: path,
    payload: value,
    options: {
      'Content-Format': content.text
    }
  }, processResponse);
}

/**
 * Write the attributes given as a parameter in the remote resource identified by the Object type and id in the
 * selected device.
 *
 * @param {String} ep             ID of the device that holds the resource.
 * @param {String} objectId           ID of the object type of the instance.
 * @param {String} instanceId             ID of the instance whose resource will be modified.
 * @param {String} resourceId           ID of the resource to modify.
 * @param {Object} parameters           Object with the parameters to write: each parameter is stored as an attribute.
 */
function writeAttributes(ep, path, attributes, callback) {
  function createQueryParams() {
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
      throw new errors.UnsupportedAttributes(errorList);
    } else {
      return result;
    }
  }

  function processResponse(err, res) {
    if (err) {
      callback(err);
      return;
    }

    if (res.code === '2.04') {
      callback(null, res.payload.toString('utf8'));
    } else if (res.code === '4.04') {
      callback(new errors.ObjectNotFound(path));
    } else {
      callback(new errors.ClientError(res.code));
    }
  }

  debug('Writting new discover attributes on resource %s in device [%s]',
    path, ep);
  debug('The new attributes are:\n%j', attributes);


  this.sendRequest(ep, {
    pathname: path,
    method: 'PUT',
    query: createQueryParams()
  }, processResponse);
}

/**
 * Execute a discover operation for the selected resource, identified following the LWTM2M conventions by its:
 * ep, objectId, instanceId and resourceId.
 */
function discover(ep, path, callback) {
  function processResponse(err, res) {
    if (err) {
      callback(err);
      return;
    }

    if (res.code === '2.05') {
      callback(null, res.payload.toString('utf8'));
    } else if (res.code === '4.04') {
      callback(new errors.ObjectNotFound(path));
    } else {
      callback(new errors.ClientError(res.code));
    }
  }

  debug('Executing a discover operation on path %s in device [%s]',
    path, ep);

  this.sendRequest(ep, {
    method: 'GET',
    pathname: path,
    options: {
      'Accept': content.link
    }
  }, processResponse);
}

function create(ep, path, value, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (!utils.isObject(path)) {
    throw new Error('Bad path `' + path + '`');
  }

  var mediaType = utils.getMediaType(path, value, options.format);
  var schema = options.schema || this._schemas['/' + objectId(path)];
  var payload;

  if (typeof value === 'object') { // object --> schema
    try {
      if (!schema) {
        throw new Error('missing schema');
      }

      switch(mediaType) {
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

  function processResponse(err, res) {
    if (err) {
      callback(err);
      return;
    }

    if (res.code === '2.01') {
      callback(null);
    } else if (res.code === '4.04') {
      callback(new errors.ObjectNotFound(path));
    } else {
      callback(new errors.ClientError(res.code));
    }
  }

  debug('Creating a new Object Instance in %s', path);

  this.sendRequest(ep, {
    method: 'POST',
    pathname: path,
    payload: payload,
    options: {
      'Content-Format': mediaType
    }
  }, processResponse);
}

function remove(ep, path, callback) {
  function processResponse(err, res) {
    if (err) {
      callback(err);
      return;
    }

    if (res.code === '2.02') {
      callback(null);
    } else if (res.code === '4.04') {
      callback(new errors.ObjectNotFound(path));
    } else {
      callback(new errors.ClientError(res.code));
    }
  }

  debug('Delete Object Instance in %s', path);

  this.sendRequest(ep, {
    method: 'DELETE',
    pathname: path
  }, processResponse);
}

exports.read = read;
exports.write = write;
exports.execute = execute;
exports.writeAttributes = writeAttributes;
exports.discover = discover;
exports.create = create;
exports.remove = remove;
