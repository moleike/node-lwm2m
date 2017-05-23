/*
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
var bootstrap = require('./bootstrap');
var async = require('async');
var debug = require('debug')('lwm2m');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var contentFormats = require('../contentFormats');
var objectAssign = require('object-assign');
var url = require('url');

function Bootstrap(options) {
  if (!(this instanceof Bootstrap)) {
    return new Bootstrap(options);
  }

  EventEmitter.call(this);

  var opts = defaultOptions(options);
  var that = this;

  this._udpWindow = opts.udpWindow;
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


  this._server.on('request', function(req, res) {
    return that._router(req, res);
  });

  this._server.on('error', function(error) {
    that.emit('error', error);
  });

  registerFormats();

  loadRoutes.call(this);
  loadDefaultHandlers.call(this);
}

util.inherits(Bootstrap, EventEmitter);

Bootstrap.prototype.listen = function(port) {
  this._port = port;
  this._server.listen(port, function(err) {
    if (err) {
      debug('Couldn\'t start COAP server: %s', err);
    } else {
      debug('COAP Server started successfully');
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
    defaultType: 'Device',
    type : 'udp6',
    schemas: { }
  }, options);
}

function loadDefaultHandlers() {
  var that = this;

  debug('Loading default handlers');

  this._router.handlers = {
    request: {
      lib : bootstrap.handle,
      user: function(device, callback) {
        that.emit('request', device, callback)
      }
    }
  };
};

function loadRoutes() {
  debug('Loading routes');

  this._router.routes = [
      ['POST', /\/bs$/, 'request']
  ];
};

Bootstrap.prototype.close = function(callback) {
  var that = this;

  debug('Closing bootstrap server');

  this._server.close(function() {
    that.emit('close');
    callback();
  });
};

Bootstrap.prototype.send = function(request, callback) {
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

Bootstrap.prototype.write = bootstrap.write;
Bootstrap.prototype.remove = bootstrap.remove;
Bootstrap.prototype.finish = bootstrap.finish;

module.exports.createServer = Bootstrap;
