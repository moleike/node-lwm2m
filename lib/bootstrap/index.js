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
var CoapServer = coap.createServer;
var bootstrap = require('./bootstrap');
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
    defaultType: 'Device',
    type : 'udp6',
    schemas: { }
  }, options, { proxy: true });
}

function loadDefaultHandlers(server) {

  debug('Loading default handlers');

  server._router.handlers = {
    bootstrapRequest: {
      lib : bootstrap.handle,
      user: function(device, callback) {
        server.emit('bootstrapRequest', device, callback);
      }
    }
  };
}

function loadRoutes(server) {
  debug('Loading routes');

  server._router.routes = [
      ['POST', /\/bs$/, 'bootstrapRequest']
  ];
}


function Bootstrap(options) {
  if (!(this instanceof Bootstrap)) {
    return new Bootstrap(options);
  }

  var that = this;
  var opts = defaultOptions(options);
  CoapServer.call(this, opts);

  this._udpWindow = opts.udpWindow;
  this._defaultType = opts.defaultType;
  this._schemas = opts.schemas;

  this._router = new Router({
    type: opts.type,
    udpWindow: opts.udpWindow
  });

  this.on('request', function(req, res) {
    return that._router(req, res);
  });

  loadRoutes.call(null, this);
  loadDefaultHandlers.call(null, this);

  registerFormats();
}

Bootstrap.prototype = Object.create(CoapServer.prototype);
Bootstrap.prototype.constructor = Bootstrap;

Object.assign(Bootstrap.prototype, bootstrap);

Bootstrap.prototype.send = function(request, callback) {
  request.proxyUri = url.format({ 
    protocol: 'coap', 
    slashes: true, 
    hostname: request.host, 
    port: request.port 
  });

  request.host = (this._options.type === 'udp6') ? '::1':'127.0.0.1';
  request.port = this._port;

  this._router.sendRequest(request, callback);
};

module.exports.createServer = Bootstrap;
