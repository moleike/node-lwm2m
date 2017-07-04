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

var Router = require('../router');
var coap = require('coap');
var CoapServer = coap.createServer;
var deviceManagement = require('./deviceManagement');
var informationReporting = require('./informationReporting');
var bootstrap = require('./bootstrap');
var Registry = require('./registry');
var debug = require('debug')('lwm2m');
var contentFormats = require('../contentFormats');
var objectAssign = require('object.assign');
var url = require('url');

function registerFormats() {
  contentFormats.formats.forEach(function(format) {
    coap.registerFormat(format.name, format.value);
  });
}

function defaultOptions(options) {
  return Object.assign({
    udpWindow: 100,
    type : 'udp6',
    bootstrap : false,
    registry : new Registry(), // default in-memory registry
    schemas: { }
  }, options || {}, { proxy: true });
}

function loadDefaultHandlers(server) {
  debug('Loading default handlers');

  if (server.bootstrap) {
    server._router.handlers = {
      bootstrapRequest: {
        lib : bootstrap.handle.bind(server),
        user: function bootstrapRequest(params, callback) {
          server.emit('bootstrapRequest', params, callback);
        }
      }
    };
  } else {
    server._router.handlers = {
      register: {
        lib: require('./registration').handle.bind(server),
        user: function register(params, callback) {
          server.emit('register', params, callback);
        }
      },
      unregister: {
        lib: require('./unregistration').handle.bind(server),
        user: function unregister(location, callback) {
          server.emit('unregister', location, callback);
        }
      },
      update: {
        lib: require('./updateRegistration').handle.bind(server),
        user: function update(params, callback) {
          server.emit('update', params, callback);
        }
      }
    };
  }
}

function loadRoutes(server) {
  debug('Loading routes');

  if (server.bootstrap) {
    server._router.routes = [
      ['POST', /\/bs$/, 'bootstrapRequest']
    ];
  } else {
    server._router.routes = [
      ['POST', /\/rd$/, 'register'],
      ['DELETE', /\/rd\/.*/, 'unregister'],
      ['POST', /\/rd\/.*/, 'update']
    ];
  }
}

function loadInterfaces(server) {
  if (server.bootstrap) {
    Object.assign(server, bootstrap);
  } else {
    Object.assign(server, deviceManagement);
    Object.assign(server, informationReporting);
  }
}

/**
 * Server constructor.
 *
 * Options:
 *
 * - `type`: indicates if the server should create IPv4 connections (udp4) or IPv6 connections (udp6). Defaults to udp6.
 * - `piggybackReplyMs`: set the number of milliseconds to wait for a piggyback response. Default 50.
 * - `registry`
 * - `schemas`: default schemas to use.
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
 *     console.log('endpoint %s contains %s', 
 *       params.ep, params.payload);
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

  var that = this;
  var opts = defaultOptions(options);
  CoapServer.call(this, opts);

  this.bootstrap = opts.bootstrap;
  this._schemas = opts.schemas;
  this._registry = opts.registry;
  this._router = new Router({
    type: opts.type,
    udpWindow: opts.udpWindow
  });


  this.on('request', function(req, res) {
    return that._router(req, res);
  });

  registerFormats();

  loadInterfaces.call(null, this);
  loadRoutes.call(null, this);
  loadDefaultHandlers.call(null, this);
}

Server.prototype = Object.create(CoapServer.prototype);
Server.prototype.constructor = Server;

/*
 * send request to endpoint name
 */
Server.prototype._request = function(ep, reqParams) {
  var that = this;

  var promise = this._find(ep).then(function(device) {
    reqParams.proxyUri = url.format({ 
      protocol: 'coap',
      slashes: true,
      hostname: device.address,
      port: device.port
    });

    reqParams.host = (that._options.type === 'udp6') ? '::1':'127.0.0.1';
    reqParams.port = that._port;

    return that._router.sendRequest(reqParams);
  });

  return promise;
};

Server.prototype.getRegistry = function() {
  return this._registry;
};

Server.prototype._find = function(name) {
  var registry = this._registry;

  return new Promise(function(resolve, reject) {
    registry.find(name, function(err, dev) {
      if (err) {
        reject(err)
      } else {
        resolve(dev);
      }
    });
  });
};

module.exports = Server;
