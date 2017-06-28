/*
 * Copyright 2017 Alexandre Moreno <alex_moreno@tutk.com>
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
var content = require('../contentFormats');
var debug = require('debug')('lwm2m');
var utils = require('../utils');
var objectId = utils.objectId;
var objectValues = require('object.values');
var Schema = require('../schema');

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
 *   var schema = Schema({
 *     test: { id: 1, type: Number }
 *   });
 *
 *   server.read('dev0', '/1024/11', { schema }, function(err, res) {
 *     assert(res.hasOwnProperty('test'));
 *     assert(typeof res.test == 'number');
 *   });
 *
 * Schemas can be preloaded on the constructor e.g.
 *
 *   var server = lwm2m.createServer({ schemas: {
 *     '/3': Schema(require('lwm2m/oma/device.json'))
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
exports.read = function(ep, path, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  var opts = options || { };
  var schema = opts.schema || this._schemas['/' + objectId(path)];

  if (!(schema instanceof Schema)) {
    throw new TypeError('Illegal schema');
  }

  var processResponse = function(res) {
    return new Promise(function(resolve, reject) {
      switch (res.code) {
        case '2.05':
          var body = utils.parsePayload(res, schema);

          if (utils.isResource(path)) {
            body = objectValues(body).pop();
          }
          resolve(body);
          break;
        case '4.04':
          reject(new errors.ResourceNotFound());
          break;
        default:
          reject(new errors.ClientError(res.code));
      }
    });
  };

  debug('Reading value from %s from device %s', path, ep);

  var promise = this._request(ep, { 
    method: 'GET', 
    pathname: path
  }).then(processResponse); 
    
  if (callback) {
    promise.then(callback.bind(null, null), callback);
  }

  return promise;
};

/**
 * Makes a Write operation over the designed resource ID of the selected device.
 *
 * @param {String} ep
 * @param {String} path
 * @param {Object|String|Number|Buffer} value
 * @param {Object} [options]
 * @param {Function} callback
 */
exports.write = function(ep, path, value, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  var method = utils.isResource(path) ? 'PUT' : 'POST';
  var mediaType = utils.getMediaType(path, value, options.format);
  var payload;

  if (typeof value === 'object') { // object --> schema

    var schema = options.schema || this._schemas['/' + objectId(path)];

    if (!(schema instanceof Schema)) {
      throw new TypeError('Illegal schema');
    }

    try {
      payload = utils.generatePayload(value, schema, mediaType);
    } catch (e) {
      if (callback) {
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
        resolve(res.payload.toString('utf8'));
      } else if (res.code === '4.04') {
        reject(new errors.ObjectNotFound(path));
      } else {
        reject(new errors.ClientError(res.code));
      }
    });
  };

  debug('Writing a new value on path %s from device %s',
    path, ep);

  var promise = this._request(ep, {
    method: method,
    pathname: path,
    payload: payload,
    options: {
      'Content-Format': mediaType
    }
  }).then(processResponse); 
    
  if (callback) {
    promise.then(callback.bind(null, null), callback);
  }

  return promise;
};

/**
 * Makes an Execute operation over the designed resource ID of the selected device.
 *
 * @param {String} ep
 * @param {String} path
 * @param {String} value
 * @param {Function} callback
 */
exports.execute = function(ep, path, value, callback) {
  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  var processResponse = function(res) {
    return new Promise(function(resolve, reject) {
      if (res.code === '2.04') {
        resolve(res.payload.toString('utf8'));
      } else if (res.code === '4.04') {
        reject(new errors.ObjectNotFound(path));
      } else {
        reject(new errors.ClientError(res.code));
      }
    });
  };

  debug('Executing resource %s from device %s', path, ep);

  var promise = this._request(ep, {
    method: 'POST',
    pathname: path,
    payload: value,
    options: {
      'Content-Format': content.text
    }
  }).then(processResponse); 
    
  if (callback) {
    promise.then(callback.bind(null, null), callback);
  }

  return promise;
};

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
exports.writeAttributes = function(ep, path, attributes, callback) {
  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  var createQueryParams = function() {
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
  };

  var processResponse = function(res) {
    return new Promise(function(resolve, reject) {
      if (res.code === '2.04') {
        resolve(res.payload.toString('utf8'));
      } else if (res.code === '4.04') {
        reject(new errors.ObjectNotFound(path));
      } else {
        reject(new errors.ClientError(res.code));
      }
    });
  };

  debug('Writing attributes `%o` on resource %s from device %s',
    attributes, path, ep);

  var promise = this._request(ep, {
    pathname: path,
    method: 'PUT',
    query: createQueryParams()
  }).then(processResponse); 
    
  if (callback) {
    promise.then(callback.bind(null, null), callback);
  }

  return promise;
};

/**
 * Execute a discover operation for the selected resource.
 *
 * @param {String} ep
 * @param {String} path
 * @param {Function} callback
 */
exports.discover = function(ep, path, callback) {
  var processResponse = function(res) {
    return new Promise(function(resolve, reject) {
      if (res.code === '2.05') {
        resolve(res.payload.toString('utf8'));
      } else if (res.code === '4.04') {
        reject(new errors.ObjectNotFound(path));
      } else {
        reject(new errors.ClientError(res.code));
      }
    });
  };

  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  debug('Discover operation on path %s from device %s',
    path, ep);

  var promise = this._request(ep, {
    method: 'GET',
    pathname: path,
    options: {
      'Accept': content.link
    }
  }).then(processResponse); 
    
  if (callback) {
    promise.then(callback.bind(null, null), callback);
  }

  return promise;
};

/**
 * Create a new LWM2M Object for `path`, where path is an Object ID.
 *
 * @param {String} ep
 * @param {String} path
 * @param {Object|String|Number|Buffer} value
 * @param {Object} [options]
 * @param {Function} callback
 */
exports.create = function(ep, path, value, options, callback) {
  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  if (!utils.isObject(path)) {
    throw new Error('Not a path to Object ID: `' + path + '`');
  }

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var mediaType = utils.getMediaType(path, value, options.format);
  var payload;

  if (typeof value === 'object') { // object --> schema

    var schema = options.schema || this._schemas['/' + objectId(path)];

    if (!(schema instanceof Schema)) {
      throw new TypeError('Illegal schema');
    }

    try {
      payload = utils.generatePayload(value, schema, mediaType);
    } catch (e) {
      if (callback) {
        callback(e);
      } else {
        return Promise.reject(e);
      }
    }
  } else {
    // FIXME we are not validating here
    payload = value;
  }

  var processResponse = function(res) {
    return new Promise(function(resolve, reject) {
      if (res.code === '2.01') {
        resolve();
      } else if (res.code === '4.04') {
        reject(new errors.ObjectNotFound(path));
      } else {
        reject(new errors.ClientError(res.code));
      }
    });
  };

  debug('Creating a new Object Instance in %s from device %s',
    path, ep);

  var promise = this._request(ep, {
    method: 'POST',
    pathname: path,
    payload: payload,
    options: {
      'Content-Format': mediaType
    }
  }).then(processResponse); 
    
  if (callback) {
    promise.then(callback.bind(null, null), callback);
  }

  return promise;
};

/**
 * Deletes the LWM2M Object instance in `path` of endpoint `ep`
 *
 * @param {String} ep
 * @param {String} path
 * @param {Function} callback
 */
exports.remove = function(ep, path, callback) {
  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  if (!utils.isInstance(path)) {
    throw new Error('Not a path to an Instance: `' + path + '`');
  }

  var processResponse = function(err, res) {
    return new Promise(function(resolve, reject) {
      if (res.code === '2.02') {
        resolve();
      } else if (res.code === '4.04') {
        reject(new errors.ObjectNotFound(path));
      } else {
        reject(new errors.ClientError(res.code));
      }
    });
  };

  debug('Delete Object Instance in %s from device %s',
    path, ep);

  var promise = this._request(ep, {
    method: 'DELETE',
    pathname: path
  }).then(processResponse); 
    
  if (callback) {
    promise.then(callback.bind(null, null), callback);
  }

  return promise;
};
