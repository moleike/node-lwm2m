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
var objectId = utils.objectId;
var objectValues = require('object.values');

/**
 * Read `path` on device with endpoint name `ep`. The callback is given
 * the two arguments `(err, res)`, where `res` is parsed using `schema`.
 * A path represents either an LWM2M Object instance or resource.
 *
 * Options:
 *
 * - `schema` defining resources.
 *
 * Example:
 *
 *   var schema = {
 *     test: { id: 1, type: Number }
 *   };
 *
 *   server.read('dev0', '/1024/11', { schema }, function(err, res) {
 *     assert(res.hasOwnProperty('test'));
 *     assert(typeof res.test == 'number');
 *   });
 *
 * Schemas can be preloaded on the constructor e.g.
 *
 *   var server = lwm2m.createServer({ schemas: {
 *     '/3': require('lwm2m/oma/device.json')
 *   }});
 *
 *   server.read('dev0', '/3/0', function(err, device) {
 *     assert(device.hasOwnProperty('manufacturer'));
 *   });
 *
 *   server.read('dev0', '/3/0/5', function(err, pwrSrcs) {
 *     assert(Array.isArray(pwrSrcs));
 *   });
 *
 * Note:
 *
 * _If no schema is provided will return a `Buffer` if the payload is `TLV`-encoded
 * or opaque, or an `String` otherwise._
 *
 * @param {String} ep
 * @param {String} path
 * @param {Object} [options]
 * @param {Function} callback
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
 *
 * @param {String} ep
 * @param {String} path
 * @param {Object|String|Number|Buffer} value
 * @param {Object} [options]
 * @param {Function} callback
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
      paylaod = utils.generatePayload(value, schema, mediaType);
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

  debug('Writing a new value on path %s in device [%s]',
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
 *
 * @param {String} ep
 * @param {String} path
 * @param {String} value
 * @param {Function} callback
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
 * Write `attributes` into `path` of endpoint `ep`.
 *
 * Example:
 *
 *   var attr = {
 *     "pmin": 5,
 *     "pmax": 10
 *   };
 *
 *   server.writeAttributes('dev0', '3303/0/5700', attr, function(err, res) {
 *      assert.ifError(err);
 *   });
 *
 * @param {String} ep
 * @param {String} path
 * @param {Object} attributes
 * @param {Function} callback
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

  debug('Writing new discover attributes on resource %s in device [%s]',
    path, ep);
  debug('The new attributes are:\n%j', attributes);


  this.sendRequest(ep, {
    pathname: path,
    method: 'PUT',
    query: createQueryParams()
  }, processResponse);
}

/**
 * Execute a discover operation for the selected resource.
 *
 * @param {String} ep
 * @param {String} path
 * @param {Function} callback
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
/**
 * Create a new LWM2M Object for `path`, where path is an Object ID.
 *
 * @param {String} ep
 * @param {String} path
 * @param {Object|String|Number|Buffer} value
 * @param {Object} [options]
 * @param {Function} callback
 */
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
      paylaod = utils.generatePayload(value, schema, mediaType);
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

/**
 * Deletes the LWM2M Object instance in `path` of endpoint `ep`
 *
 * @param {String} ep
 * @param {String} path
 * @param {Function} callback
 */
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
