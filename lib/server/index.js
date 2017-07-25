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
var register = require('./register');
var update = require('./update');
var deregister = require('./deregister');
var Schema = require('../schema');
var schemas = require('../..').schemas;
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
 * Options:
 *
 * - `type`: indicates if the server should create IPv4 connections (udp4) or IPv6 connections (udp6). Defaults to udp6.
 * - `piggybackReplyMs`: set the number of milliseconds to wait for a piggyback response. Default 50.
 * - `registry`
 *
 * Events:
 *
 * - `register`: device registration request.
 * - `update`: device registration update.
 * - `unregister`: device unregistration.
 *
 * Examples:
 *
 *   var lwm2m = require('lwm2m');
 *   var Device = require('lwm2m/oma/device.json');
 *
 *   var server = lwm2m.createServer();
 *
 *   server.on('error', function(err) {
 *     throw err;
 *   });
 *
 *   server.on('close', function() {
 *     console.log('server is done');
 *   });
 *
 *   server.on('register', function(params, accept) {
 *     console.log('endpoint %s contains %s', params.ep, params.payload);
 *     accept();
 *   });
 *
 *   // the default CoAP port is 5683
 *   server.listen();
 *
 * @param {Object} options
 */
function Server(options) {
  if (!(this instanceof Server)) {
    return new Server(options);
  }

  var opts = defaultOptions(options);

  CoapServer.call(this, opts);

  var registry = opts.registry;
  var validate = this._validate.bind(this);

  var router = Router({
    udpWindow: opts.udpWindow,
    routes: [
      [ 'POST',    /\/rd$/,    validate ],
      [ 'POST',    /\/rd$/,    register(registry) ],
      [ 'POST',    /\/rd\/.+/, update(registry) ],
      [ 'DELETE',  /\/rd\/.+/, deregister(registry) ]
    ]
  });

  var _this = this;
  registry.on('update', function(location) {
    _this.emit('update', location);
  });

  registry.on('deregister', function(location) {
    _this.emit('deregister', location);
  });

  Object.defineProperty(this, '_registry', {
    value : registry
  });

  this.on('request', router);
}

module.exports = Server;

Server.prototype = Object.create(CoapServer.prototype);
Server.prototype.constructor = Server;

Server.prototype._validate = function(req, res) {
  var query = utils.query(req);
  var params = Object.assign({}, query, { 
    payload: req.payload.toString() 
  });

  var _this = this;

  return new Promise(function(resolve, reject) {
    if (utils.validateQuery(query, ['ep'])) {
      _this.emit('register', params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    } else {
      reject(new errors.BadRequestError());
    }
  });
};

Server.prototype._request = function(params) {
  var request = Object.assign({}, params, {
    host: 'localhost',
    port: this._port
  });
  var type = this._options.type;

  return this._registry.find(request.endpoint)
    .then(function(device) {
      request.proxyUri = url.format({ 
        protocol: 'coap',
        slashes: true,
        hostname: device.address,
        port: device.port
      });
      return utils.send(request, type);
    });
};

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
 * Note:
 *
 * _If no schema is provided will return a `Buffer` if the payload is `TLV`-encoded
 * or opaque, or an `String` otherwise._
 *
 * @param  {String} ep
 * @param  {String} path
 * @param  {Object} [options]
 * @param  {Function} [callback]
 * @return {Promise}
 */
Server.prototype.read = function(ep, path, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }

  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  var schema = options && options.schema
    || schemas[objectId(path)];

  if (!(schema instanceof Schema)) {
    throw new TypeError('Illegal schema');
  }

  var processResponse = function(res) {
    return new Promise(function(resolve, reject) {
      switch (res.code) {
      case '2.05':
        var body = utils.parsePayload(res, schema);

        if (utils.isResource(path)
            && !Buffer.isBuffer(body)
            && typeof body !== 'string') {
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

  var promise = this._request({
    endpoint: ep, 
    method: 'GET', 
    pathname: path
  })
    .then(processResponse); 
    
  if (callback) {
    utils.invoke(callback, promise);
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
Server.prototype.write = function(ep, path, value, options, callback) {
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

  var promise = this._request({
    endpoint: ep,
    method: method,
    pathname: path,
    payload: payload,
    options: {
      'Content-Format': mediaType
    }
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
 * @param {String} ep
 * @param {String} path
 * @param {String} value
 * @param {Function} callback
 */
Server.prototype.execute = function(ep, path, value, callback) {
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

  var promise = this._request({
    endpoint: ep,
    method: 'POST',
    pathname: path,
    payload: value,
    options: {
      'Content-Format': content.text
    }
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
 * @param {String} ep
 * @param {String} path
 * @param {Function} callback
 */
Server.prototype.discover = function(ep, path, callback) {
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
    path, ep);

  var promise = this._request({
    endpoint: ep,
    method: 'GET',
    pathname: path,
    options: {
      'Accept': content.link
    }
  })
    .then(processResponse); 

    
  if (callback) {
    utils.invoke(callback, promise);
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
Server.prototype.writeAttributes = function(ep, path, attributes, callback) {
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

  var promise = this._request({
    endpoint: ep,
    pathname: path,
    method: 'PUT',
    query: createQueryParams()
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
 * @param {String} ep
 * @param {String} path
 * @param {Object|String|Number|Buffer} value
 * @param {Object} [options]
 * @param {Function} callback
 */
Server.prototype.create = function(ep, path, value, options, callback) {
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
    path, ep);

  var promise = this._request({
    endpoint: ep,
    method: 'POST',
    pathname: path,
    payload: payload,
    options: {
      'Content-Format': mediaType
    }
  })
    .then(processResponse); 
    
  if (callback) {
    utils.invoke(callback, promise);
  }

  return promise;
};

function validate(path, bootstrap) {
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
}


/**
 * Deletes the LWM2M Object instance in `path` of endpoint `ep`
 *
 * @param {String} ep
 * @param {String} path
 * @param {Function} callback
 */
Server.prototype.delete = function(ep, path, callback) {
  validate(path, this.bootstrap);

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
    path, ep);

  var promise = this._request({
    endpoint: ep,
    method: 'DELETE',
    pathname: path
  })
    .then(processResponse); 
    
  if (callback) {
    utils.invoke(callback, promise);
  }

  return promise;
};

/**
 * Observe changes in `path` of device with endpoint name `ep`. 
 * The notification behaviour, e.g. periodic or event-triggered reporting, is configured with the 
 * `writeAttributes` method. The callback is given the two arguments `(err, stream)`, 
 * where `stream` is a `Readable Stream`. To stop receiving notifications `close()` the stream
 * and (optionally) call `cancel()` on the same `ep` and `path` and .
 *
 * Example:
 *   
 *   server.observe('dev0', '/1024/10/1', function(err, stream) {
 *     stream.on('data', function(value) {
 *       console.log('new value %s', value);
 *     });
 *   
 *     stream.on('end', function() {
 *       console.log('stopped observing');
 *     });
 *   });
 *  
 *
 * @param {String} ep
 * @param {String} path
 * @param {Function} callback
 */
Server.prototype.observe = function(ep, path, options, callback) {
  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  // not implemented yet
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var processStream = function(stream) {
    var contentType = stream.headers['Content-Type'];
    var decode = new DecodeStream(contentType);

    decode.on('close', function() {
      debug('closing observe stream');
      stream.close();
    });

    return Promise.resolve(stream.pipe(decode));
  };

  debug('Observing resource %s from device %s', path, ep);

  var promise = this._request({
    endpoint: ep,
    method: 'GET',
    pathname: path,
    observe: true,
    options: {
      'Accept': content.text
    }
  })
    .then(processStream); 

  if (callback) {
    utils.invoke(callback, promise);
  }

  return promise;
};

/**
 * Cancel an observation for `path` of device `ep`.
 *
 * @param {String} ep
 * @param {String} path
 * @param {Function} callback
 */
Server.prototype.cancel = function(ep, path, callback) {
  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  debug('Cancel observation of resource %s from device %s', 
    path, ep);

  var promise = this._request({
    endpoint: ep,
    method: 'GET',
    pathname: path,
    options: {
      'Accept': content.text,
      'Observe': 1
    }
  });

  if (callback) {
    utils.invoke(callback, promise);
  }

  return promise;
};
