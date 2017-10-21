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
var debug = require('debug')('lwm2m');
var Router = require('../../router');
var CoapServer = coap.createServer;
var Registry = require('../registry');
var utils = require('../../utils');
var Server = require('../');
var errors = require('../../errors');


function defaultOptions(options) {
  return Object.assign({
    udpWindow: 100,
    type : 'udp6',
  }, options || {}, { proxy: true });
}

/**
 * Server constructor.
 *
 * Events
 *
 * - `bootstrapRequest`: device bootstrap request.
 *
 * @example
 *
 * var bootstrap = require('lwm2m').bootstrap;
 * var server = bootstrap.createServer();
 *
 * server.on('error', function(err) {
 *   throw err;
 * });
 *
 * server.on('close', function() {
 *   console.log('server is done');
 * });
 *
 * server.on('bootstrapRequest', function(params, accept) {
 *   console.log('endpoint %s contains %s', params.ep, params.payload);
 *   accept();
 * });
 *
 * // the default CoAP port is 5683
 * server.listen();
 *
 * @name bootstrap#Server
 * @augments EventEmitter
 * @param  {Object} [options]
 * @param  {string} [options.type='upd6'] - IPv4 (udp4) or IPv6 (udp6) connections
 * @param  {number} [options.piggybackReplyMs=50] - milliseconds to wait for a piggyback response
 *
 */
function BServer(options) {
  if (!(this instanceof BServer)) {
    return new BServer(options);
  }

  var opts = defaultOptions(options);
  CoapServer.call(this, opts);

  this._registry = new Registry();

  var router = Router({
    udpWindow: opts.udpWindow,
    routes: [
      [ 'POST', /\/bs$/, this._validate.bind(this) ],
      [ 'POST', /\/bs$/, 
        require('./request')(this._registry), 
      ],
    ],
  });

  this.on('request', router);
}

BServer.prototype = Object.create(CoapServer.prototype, {
  bootstrap: {
    value: true,
  },
});

BServer.prototype.constructor = BServer;

BServer.prototype._validate = function(req, res) {
  var query = utils.query(req);
  var params = Object.assign({}, query, { 
    payload: req.payload.toString(), 
  });

  var _this = this;

  return new Promise(function(resolve, reject) {
    if (utils.validateQuery(query, ['ep'], [])) {
      _this.emit('bootstrapRequest', params, function(err) {
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

BServer.prototype._request = Server.prototype._request;

/**
 * Makes a Write operation over the designed resource ID of the selected device.
 * @memberof bootstrap#Server
 * @instance
 * @param  {String} endpoint - client endpoint name
 * @param  {String} path
 * @param  {Object|String|Number|Buffer} value
 * @param  {Object} [options]
 * @param  {string} options.format - media type.
 * @param  {Schema} options.schema - schema to serialize value when an object.
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
 * var promise = server.write('test', '/42/3', value, options)
 *
 */
BServer.prototype.write = Server.prototype.write;

/**
 * Deletes the LWM2M Object instance in `path` of endpoint `endpoint`
 *
 * @memberof bootstrap#Server
 * @instance
 * @param  {String} endpoint - client endpoint name
 * @param  {String} path
 * @param  {Function} [callback]
 * @return {Promise}
 */
BServer.prototype.delete = Server.prototype.delete;

/**
 * Terminate the Bootstrap Sequence previously initiated 
 *
 * @memberof bootstrap#Server
 * @instance
 * @param  {String} endpoint - client endpoint name
 * @param  {Function} [callback]
 * @return {Promise}
 */
BServer.prototype.finish = function(endpoint, callback) { 
  var _this = this;

  var processResponse = function(res) {
    return new Promise(function(resolve, reject) {
      if (res.code === '2.04') {
        return _this._registry.find(endpoint)
          .then(function(client) {
            return _this._registry.unregister(client.location);
          })
          .then(function() {
            resolve(res.payload.toString('utf8'));
          });
      } else {
        reject(new errors.ClientError(res.code));
      }
    });
  };

  debug('Bootstrap finish request on device [%s]', endpoint);

  var promise = _this._request({
    endpoint: endpoint, 
    method: 'POST',
    pathname: '/bs',
  })
    .then(processResponse); 

  if (callback) {
    utils.invoke(callback, promise);
  }

  return promise;
};

/**
 * @returns {bootstrap#Server} object
 * @alias bootstrap#createServer
 */
module.exports.createServer = BServer;

