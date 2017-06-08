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
    lifetimeCheckInterval: 300 * 1e3,
    defaultType: 'Device',
    type : 'udp6',
    deviceRegistry : { },
    schemas: { }
  }, options, { proxy: true });
}

function loadDefaultHandlers(server) {
  debug('Loading default handlers');

  function register(ep, lt, lwm2m, b, payload, callback) {
    server.emit('register', ep, lt, lwm2m, b, payload, callback);
  }

  function update(updatedObj, payload, callback) {
    server.emit('update', updatedObj, payload, callback);
  }

  function unregister(location, callback) {
    server.emit('unregister', location, callback);
  }

  server._registry.checkLifetime(server._lifetimeCheckInterval, 
    unregister);

  server._router.handlers = {
    register: {
      lib: require('./registration').handle.bind(server),
      user: register
    },
    unregister: {
      lib: require('./unregistration').handle.bind(server),
      user: unregister
    },
    update: {
      lib: require('./updateRegistration').handle.bind(server),
      user: update
    }
  };

}

function loadRoutes(server) {
  debug('Loading routes');

  server._router.routes = [
    ['POST', /\/rd$/, 'register'],
    ['DELETE', /\/rd\/.*/, 'unregister'],
    ['POST', /\/rd\/.*/, 'update']
  ];
}

function loadRegistry(server, params) {
  switch(params.type) {
    case 'mongodb':
      debug('Using MongoDB Device registry');
      server._registry = require('./mongodbDeviceRegistry');
      break;
    default:
      debug('Using in-memory Device registry');
      server._registry = require('./inMemoryDeviceRegistry');
      break;
  }

  server._registry.connect(params, function() {
    debug('Registry connected');

    server._registry.checkLifetime(server._lifetimeCheckInterval);
  });
}

/**
 * Server constructor.
 *
 * Options:
 *
 * - `lifetimeCheckInterval`: time in ms to purge a device from the registry if it didn't update it's registration,
 * - `defaultType`: the type of device, defaults to 'Device',
 * - `type`: indicates if the server should create IPv4 connections (udp4) or IPv6 connections (udp6). Defaults to udp6.
 * - `deviceRegistry`: specifies a MongoDB connection. If not provided will run an in-memory registry.
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
 *   var server = lwm2m.createServer({
 *     lifetimeCheckInterval: 300 * 1e3,
 *     defaultType: 'Device',
 *     type : 'udp6',
 *     deviceRegistry: {
 *       type: 'mongodb',
 *       host: 'localhost',
 *       port: '27017',
 *       db: 'lwm2m'
 *     },
 *     schemas: {
 *       '/3': lwm2m.Schema(require('lwm2m/oma/device.json')),
 *     }
 *   });
 *
 *    server.on('error', function(err) {
 *      throw err;
 *    });
 *
 *    server.on('close', function() {
 *      console.log('server finished');
 *    })
 *
 *    server.on('register', registrationHandler)
 *    server.on('update', updateHandler)
 *    server.on('unregister', unregistrationHandler)
 *
 *    server.listen(port);
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

  this._udpWindow = opts.udpWindow;
  this._lifetimeCheckInterval = opts.lifetimeCheckInterval; // TODO get rid of this
  this._defaultType = opts.defaultType;
  this._schemas = opts.schemas;

  this._router = new Router({
    type: opts.type,
    udpWindow: opts.udpWindow
  });

  this.on('request', function(req, res) {
    return that._router(req, res);
  });

  this.on('close', function() {
    that.cleanObservers(function() {
      debug('Closing server');
    });
  });

  this.observers = { };
  loadRegistry.call(null, this, opts.deviceRegistry);
  loadRoutes.call(null, this);
  loadDefaultHandlers.call(null, this);

  registerFormats();

}

Server.prototype = Object.create(CoapServer.prototype);
Server.prototype.constructor = Server;

Object.assign(Server.prototype, deviceManagement);
Object.assign(Server.prototype, informationReporting);

Server.prototype.sendRequest = function(ep, request, callback) {
  var that = this;

  this.getDevice(ep, function(err, device) {
    if (err) {
      callback(err);
      return;
    }

    request.proxyUri = url.format({ 
      protocol: 'coap',
      slashes: true,
      hostname: device.address,
      port: device.port
    });

    request.host = (that._options.type === 'udp6') ? '::1':'127.0.0.1';
    request.port = that._port;

    that._router.sendRequest(request, callback);
  });
};

Server.prototype.getRegistry = function() {
  return this._registry;
};

Server.prototype.listDevices = function(callback) {
  return this._registry.list(callback);
};

Server.prototype.getDevice = function(name, callback) {
  return this._registry.getByName(name, callback);
};

module.exports = Server;
