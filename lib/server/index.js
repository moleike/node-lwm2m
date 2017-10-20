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
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */

'use strict';

var coap = require('coap');
var url = require('url');
var debug = require('debug')('lwm2m');
var Router = require('../router');
var errors = require('../errors');
var content = require('../contentFormats');
var utils = require('../utils');
var Registry = require('./registry');
var Schema = require('../schema');
var schemas = require('../').schemas;
var DecodeStream = require('./decodestream');
var CoapServer = coap.createServer;
var objectId = utils.objectId;

function defaultOptions(options) {
  return Object.assign({
    udpWindow: 100,
    type : 'udp6',
    registry : new Registry(), // default in-memory registry
  }, options || {}, { proxy: true });
}

/**
 * Server constructor.
 *
 * Events:
 *
 * - `register`: device registration request.
 * - `update`: device registration update.
 * - `unregister`: device unregistration.
 *
 * @constructor
 * @augments EventEmitter
 * @param  {Object} [options]
 * @param  {string} [options.type='upd6'] - IPv4 (udp4) or IPv6 (udp6) connections
 * @param  {number} [options.piggybackReplyMs=50] - milliseconds to wait for a piggyback response
 * @param  {Registry} [options.registry=Registry] - impl. of CoRE Resource Directory
 */
function Server(options) {
  if (!(this instanceof Server)) {
    return new Server(options);
  }

  var opts = defaultOptions(options);

  CoapServer.call(this, opts);

  var registry = opts.registry;

  Object.defineProperty(this, '_registry', {
    value : registry,
  });

  var _this = this;

  /*
   * middlewares
   */
  var validate = require('./validate');
  var register = require('./register')(registry);
  var update = require('./update')(registry);
  var deregister = require('./deregister')(registry);

  function authorize(req, res) {
    var params = Object.assign({}, utils.query(req), { 
      payload: req.payload.toString(), 
    });

    return new Promise(function(resolve, reject) {
      _this.emit('register', params, function(err) {
        if (err) {
          debug(err);
          reject(new errors.ForbiddenError(err.message));
        } else {
          resolve();
        }
      });
    });
  }

  registry.on('update', function(location) {
    _this.emit('update', location);
  });

  registry.on('deregister', function(location) {
    _this.emit('deregister', location);
  });

  registry.on('error', function(err) {
    _this.emit('error', err);
  });

  var router = Router({
    udpWindow: opts.udpWindow,
    routes: [
      ['POST',    /\/rd$/,    validate],
      ['POST',    /\/rd$/,    authorize],
      ['POST',    /\/rd$/,    register],
      ['POST',    /\/rd\/.+/, validate],
      ['POST',    /\/rd\/.+/, update],
      ['DELETE',  /\/rd\/.+/, deregister],
    ],
  });

  this.on('request', router);
}

module.exports = Server;
Server.prototype = Object.create(CoapServer.prototype);
Server.prototype.constructor = Server;

Server.prototype._request = function(params) {
  var request = Object.assign({}, params, {
    host: 'localhost',
    port: this._port,
  });
  var type = this._options.type;

  return this._registry.find(request.endpoint)
    .then(function(device) {
      request.proxyUri = url.format({ 
        protocol: 'coap',
        slashes: true,
        hostname: device.address,
        port: device.port,
      });
      return utils.send(request, type);
    });
};

/**
 * Read `path` on device with endpoint name `endpoint`. The optional callback is given
 * the two arguments `(err, res)`, where `res` is parsed using `schema`.
 *
 * Note:
 *
 * _If no schema is provided will return a `Buffer` if the payload is `TLV`-encoded
 * or opaque, or an `String` otherwise._
 *
 * @example
 *
 * var schema = Schema({
 *   test: { id: 1, type: Number }
 * });
 *
 * server.read('test', '/1024/11', { schema }, function(err, res) {
 *   assert(res.hasOwnProperty('test'));
 *   assert(typeof res.test == 'number');
 * });
 *
 *
 * @param  {String} endpoint - client endpoint name
 * @param  {String} path - either an LWM2M Object instance or resource
 * @param  {Object} [options]
 * @param  {Schema} options.schema - defining resources.
 * @param  {Function} [callback]
 * @return {Promise<Object|string|Buffer|number>} - a promise of the eventual value
 */
Server.prototype.read = function(endpoint, path, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }

  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  var schema = options && options.schema
    || schemas[objectId(path)];

  if (schema && !(schema instanceof Schema)) {
    throw new TypeError('Illegal schema');
  }

  var processResponse = function(res) {
    return new Promise(function(resolve, reject) {
      switch (res.code) {
      case '2.05':
        var contentFormat = utils.getOption(res, 'Content-Format'); 
        var body = utils.parsePayload(res.payload, contentFormat, schema);
        resolve(body);
        break;
      case '4.04':
        reject(new errors.ObjectNotFound(path));
        break;
      default:
        reject(new errors.ClientError(res.code));
      }
    });
  };

  debug('Reading value from %s from device %s', path, endpoint);

  var promise = this._request({
    endpoint: endpoint, 
    method: 'GET', 
    pathname: path,
  })
    .then(processResponse); 
    
  if (callback) {
    utils.invoke(callback, promise);
  }

  return promise;
};

/**
 * Write `value` into `path` of device with endpoint name `endpoint`.
 * For writing Object Instances, an schema is required.
 *
 * Note:
 *
 * _schemas can be globally added to `lwm2m.schemas`._
 *
 * @param  {String} endpoint - client endpoint name
 * @param  {String} path
 * @param  {Object|String|Number|Buffer} value
 * @param  {Object} options
 * @param  {string} [options.format='tlv'] - media type.
 * @param  {Schema} [options.schema] - schema to serialize value.
 * @param  {Function} [callback]
 * @return {Promise}
 * @example
 *
 * var schema = Schema({
 *   foo : { 
 *     id: 5, 
 *     type: 'String' 
 *   },
 *   bar : { 
 *     id: 6, 
 *     type: 'Number' 
 *   },
 * });
 *
 * var options = { 
 *   schema: schema, 
 *   format: 'json',
 * };
 *
 * var value = {
 *   foo: 'test',
 *   bar: 42,
 * };
 *
 * var promise = server.write('test', '/42/0', value, options)
 * var promise = server.write('test', '/42/0/5', 'test')
 * var promise = server.write('test', '/42/0/6', 42)
 *
 * // add schema for Object ID 42 globally.
 * lwm2m.schemas[42] = schema;
 *
 * var promise = server.write('test', '/42/0', value)
 *
 */
Server.prototype.write = function(endpoint, path, value, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  var method = utils.isResource(path) ? 'PUT' : 'POST';
  var mediaType = utils.getMediaType(path, value, options && options.format);
  var payload;

  if (typeof value === 'object') {

    var schema = options && options.schema
      || schemas[objectId(path)];

    if (!(schema instanceof Schema)) {
      throw new TypeError('Illegal schema');
    }

    value.bn = path;

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
    path, endpoint);

  var promise = this._request({
    endpoint: endpoint,
    method: method,
    pathname: path,
    payload: payload,
    options: {
      'Content-Format': mediaType,
    },
  })
    .then(processResponse); 
    
  if (callback) {
    utils.invoke(callback, promise);
  }

  return promise;
};

/**
 * Makes an Execute operation over the designed resource ID of the selected device.
 *
 * @param  {String} endpoint - client endpoint name
 * @param  {String} path
 * @param  {String} value
 * @param  {Function} callback
 * @return {Promise}
 */
Server.prototype.execute = function(endpoint, path, value, callback) {
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

  debug('Executing resource %s from device %s', path, endpoint);

  var promise = this._request({
    endpoint: endpoint,
    method: 'POST',
    pathname: path,
    payload: value,
    options: {
      'Content-Format': content.text,
    },
  })
    .then(processResponse); 
    
  if (callback) {
    utils.invoke(callback, promise);
  }

  return promise;
};

/**
 * Execute a discover operation for the selected resource.
 *
 * @param  {String} endpoint - client endpoint name
 * @param  {String} path
 * @param  {Function} callback
 * @return {Promise<string>} - a promise with an strng in link-format
 */
Server.prototype.discover = function(endpoint, path, callback) {
  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

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

  debug('Discover operation on path %s from device %s',
    path, endpoint);

  var promise = this._request({
    endpoint: endpoint,
    method: 'GET',
    pathname: path,
    options: {
      'Accept': content.link,
    },
  })
    .then(processResponse); 

    
  if (callback) {
    utils.invoke(callback, promise);
  }

  return promise;
};

/**
 * Write `attributes` into `path` of endpoint `endpoint`.
 *
 * @param  {String} endpoint - client endpoint name
 * @param  {String} path
 * @param  {Object} attributes
 * @param  {Function} [callback]
 * @return {Promise}
 * @example
 *
 * var attr = {
 *   "pmin": 5,
 *   "pmax": 10
 * };
 *
 * server.writeAttributes('dev0', '3303/0/5700', attr, function(err, res) {
 *    assert.ifError(err);
 * });
 *
 */
Server.prototype.writeAttributes = function(endpoint, path, attributes, callback) {
  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  var valid = [
    'pmin', 
    'pmax', 
    'gt', 
    'lt', 
    'stp',
  ];

  if (!utils.validateQuery(attributes, [], valid)) {
    return Promise.reject(new errors.UnsupportedAttributes());
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

  debug('Writing attributes `%o` on resource %s from device %s',
    attributes, path, endpoint);

  var promise = this._request({
    endpoint: endpoint,
    pathname: path,
    method: 'PUT',
    query: url.format({ query: attributes }).slice(1),
  })
    .then(processResponse); 
    
  if (callback) {
    utils.invoke(callback, promise);
  }

  return promise;
};

/**
 * Create a new LWM2M Object for `path`, where path is an Object ID.
 *
 * @param  {String} endpoint - client endpoint name
 * @param  {String} path
 * @param  {Object|String|Number|Buffer} value
 * @param  {Object} [options]
 * @param  {Function} [callback]
 * @return {Promise}
 */
Server.prototype.create = function(endpoint, path, value, options, callback) {
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

  if (typeof value === 'object') {

    var schema = options && options.schema
      || schemas[objectId(path)];

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
    path, endpoint);

  var promise = this._request({
    endpoint: endpoint,
    method: 'POST',
    pathname: path,
    payload: payload,
    options: {
      'Content-Format': mediaType,
    },
  })
    .then(processResponse); 
    
  if (callback) {
    utils.invoke(callback, promise);
  }

  return promise;
};

/**
 * Deletes the LWM2M Object instance in `path` of endpoint `endpoint`
 *
 * @param  {String} endpoint - client endpoint name
 * @param  {String} path
 * @param  {Function} [callback]
 * @return {Promise}
 */
Server.prototype.delete = function(endpoint, path, callback) {
  (function (bootstrap) {
    if (bootstrap && /^\/$/.test(path)) {
      return;
    }

    if (!utils.validatePath(path)) {
      throw new Error('Illegal path: `' + path + '`');
    }

    if (bootstrap && utils.isObject(path)) {
      return;
    }

    if (!utils.isInstance(path)) {
      throw new Error('Not a path to an Instance: `' + path + '`');
    }
  })(this.bootstrap);

  var processResponse = function(res) {
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
    path, endpoint);

  var promise = this._request({
    endpoint: endpoint,
    method: 'DELETE',
    pathname: path,
  })
    .then(processResponse); 
    
  if (callback) {
    utils.invoke(callback, promise);
  }

  return promise;
};

/**
 * Observe changes in `path` of device with endpoint name `endpoint`. 
 * The notification behaviour, e.g. periodic or event-triggered reporting, is configured with the 
 * `writeAttributes` method. The callback is given the two arguments `(err, stream)`, 
 * where `stream` is a `Readable Stream`. To stop receiving notifications `close()` the stream
 * and (optionally) call `cancel()` on the same `endpoint` and `path` and .
 *
 * @example
 *   
 * server.observe('dev0', '/1024/10/1', function(err, stream) {
 *   stream.on('data', function(value) {
 *     console.log('new value %s', value);
 *   });
 * 
 *   stream.on('end', function() {
 *     console.log('stopped observing');
 *   });
 * });
 *  
 *
 * @param  {String} endpoint - client endpoint name
 * @param  {String} path
 * @param  {Function} [callback]
 * @return {Promise}
 */
Server.prototype.observe = function(endpoint, path, options, callback) {
  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var schema = options && options.schema
    || schemas[objectId(path)];

  if (schema && !(schema instanceof Schema)) {
    throw new TypeError('Illegal schema');
  }

  var processStream = function(stream) {
    var contentType = stream.headers['Content-Type'];
    var decode = new DecodeStream(contentType, schema);

    decode.on('close', function() {
      debug('closing observe stream');
      stream.close();
    });

    decode.on('error', function() {
    });

    return Promise.resolve(stream.pipe(decode));
  };

  debug('Observing resource %s from device %s', path, endpoint);

  var promise = this._request({
    endpoint: endpoint,
    method: 'GET',
    pathname: path,
    observe: true,
    options: {
      'Accept': content.text,
    },
  })
    .then(processStream); 

  if (callback) {
    utils.invoke(callback, promise);
  }

  return promise;
};

/**
 * Cancel an observation for `path` of device `endpoint`.
 *
 * @param  {String} endpoint - client endpoint name
 * @param  {String} path
 * @param  {Function} [callback]
 * @return {Promise}
 */
Server.prototype.cancel = function(endpoint, path, callback) {
  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  debug('Cancel observation of resource %s from device %s', 
    path, endpoint);

  var promise = this._request({
    endpoint: endpoint,
    method: 'GET',
    pathname: path,
    options: {
      'Accept': content.text,
      'Observe': 1,
    },
  });

  if (callback) {
    utils.invoke(callback, promise);
  }

  return promise;
};
