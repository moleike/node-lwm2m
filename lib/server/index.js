/*
 * Copyright 2014 Telefonica Investigación y Desarrollo, S.A.U
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

var Router = require('../router');
var coap = require('coap');
var errors = require('../errors');
var deviceManagement = require('./deviceManagement');
var informationReporting = require('./informationReporting');
var debug = require('debug')('lwm2m');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var contentFormats = require('../contentFormats');
var objectAssign = require('object-assign');
var url = require('url');

function Server(options) {
  if (!(this instanceof Server)) {
    return new Server(options);
  }

  EventEmitter.call(this);

  var opts = defaultOptions(options);
  var that = this;

  this._udpWindow = opts.udpWindow;
  this._lifetimeCheckInterval = opts.lifetimeCheckInterval; // TODO get rid of this
  this._type = opts.type;
  this._defaultType = opts.defaultType;
  this._schemas = opts.schemas;

  this._router = new Router({
    type: opts.type,
    updWindow: opts.udpWindow
  });

  this._server = coap.createServer({
    type: opts.type,
    proxy: true
  });

  switch(opts.deviceRegistry.type) {
    case 'mongodb':
      debug('Using MongoDB Device registry');
      this._registry = require('./mongodbDeviceRegistry');
      break;
    default:
      debug('Using in-memory Device registry');
      this._registry = require('./inMemoryDeviceRegistry');
      break;
  }

  this._registry.connect(opts.deviceRegistry, function() {
    debug('Registry connected');
  });

  this._server.on('request', function(req, res) {
    return that._router(req, res);
  });

  this._server.on('error', function(error) {
    that.emit('error', error);
  });

  this.subscriptions = { };

  registerFormats();
  loadRoutes.call(this);
  loadDefaultHandlers.call(this);
}

util.inherits(Server, EventEmitter);

Server.prototype.listen = function(port) {
  var that = this;
  this._port = port;

  this._server.listen(port, function(err) {
    if (err) {
      debug('Couldn\'t start CoAP server: %s', err);
    } else {
      that._registry.checkLifetime(that._lifetimeCheckInterval);
      debug('CoAP Server started successfully');
    }
  });
};

function registerFormats() {
  contentFormats.formats.forEach(function(format) {
    coap.registerFormat(format.name, format.value);
  });
}

function defaultOptions(options) {
  return objectAssign({
    udpWindow: 100,
    lifetimeCheckInterval: 300 * 1e3,
    defaultType: 'Device',
    type : 'udp6',
    deviceRegistry : { },
    schemas: { }
  }, options);
}

function loadDefaultHandlers() {
  var that = this;
  debug('Loading default handlers');

  function unregister(location, callback) {
    that.emit('unregister', location, callback);
  }

  this._registry.checkLifetime(this._lifetimeCheckInterval, 
    unregister);

  this._router.handlers = {
    register: {
      lib: require('./registration').handle.bind(that),
      user: function(ep, lt, lwm2m, b, payload, callback) {
        that.emit('register', ep, lt, lwm2m, b, payload, callback);
      }
    },
    unregister: {
      lib: require('./unregistration').handle.bind(that),
      user: unregister
    },
    update: {
      lib: require('./updateRegistration').handle.bind(that),
      user: function(updatedObj, payload, callback) {
        that.emit('update', updatedObj, payload, callback);
      }
    }
  };

};

function loadRoutes() {
  debug('Loading routes');

  this._router.routes = [
    ['POST', /\/rd$/, 'register'],
    ['DELETE', /\/rd\/.*/, 'unregister'],
    ['POST', /\/rd\/.*/, 'update']
  ];
};

Server.prototype.close = function(callback) {
  var that = this;
  debug('Closing server');

  that.cleanObservers(function() {
    that._server.close(function() {
      that.emit('close');
      callback();
    });
  });
};

Server.prototype.send = function(request, callback) {
  request.proxyUri = url.format({ 
    protocol: 'coap', 
    slashes: true, 
    hostname: request.host, 
    port: request.port 
  });

  request.host = (this._type === 'udp6') ? '::1':'127.0.0.1';
  request.port = this._port;

  this._router.sendRequest(request, callback);
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

Server.prototype.read = deviceManagement.read;
Server.prototype.write = deviceManagement.write;
Server.prototype.execute = deviceManagement.execute;
Server.prototype.writeAttributes = deviceManagement.writeAttributes;
Server.prototype.discover = deviceManagement.discover;
Server.prototype.create = deviceManagement.create;
Server.prototype.remove = deviceManagement.remove;
Server.prototype.observe = informationReporting.observe;
Server.prototype.listObservers = informationReporting.list;
Server.prototype.cleanObservers = informationReporting.clean;
Server.prototype.cancelObserver = informationReporting.cancel;
Server.prototype.buildObserverId = informationReporting.buildId;
Server.prototype.parseObserverId = informationReporting.parseId;

module.exports = Server;

