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

var Router = require('../coapRouter');
var coap = require('coap');
var bootstrap = require('../server/bootstrap');
var async = require('async');
var coapUtils = require('../server/coapUtils');
var debug = require('debug')('lwm2m');
var apply = async.apply;
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var contentFormats = require('../contentFormats');

function Bootstrap(options) {
  if (!(this instanceof Bootstrap)) {
    return new Bootstrap(options);
  }

  EventEmitter.call(this);

  var opts = defaultOptions(options);

  this._udpWindow = opts.udpWindow;
  this._serverProtocol = opts.serverProtocol;
  this._ipProtocol = opts.ipProtocol;
  this._defaultType = opts.defaultType;
  this._schemas = opts.schemas;
  this._router = new Router(options);

  this._server = coap.createServer({
    type: this._serverProtocol,
    proxy: true
  });

  this._server.on('request', (req, res) => {
    return this._router(req, res);
  });

  this._server.on('error', error => {
    this.emit('error', error);
  });

  registerFormats();

  loadRoutes.call(this);
  loadDefaultHandlers.call(this);

  coapUtils.init(opts);
}

util.inherits(Bootstrap, EventEmitter);

Bootstrap.prototype.listen = function(port) {
  this._port = port;
  this._server.listen(port, (err) => {
    if (err) {
      debug('Couldn\'t start COAP server: %s', err);
    } else {
      debug('COAP Server started successfully');
    }
  });
};

function registerFormats() {
  contentFormats.formats.forEach(format => {
    coap.registerFormat(format.name, format.value);
  });
}

function defaultOptions(options) {
  return Object.assign({
    udpWindow: 100,
    defaultType: 'Device',
    serverProtocol : 'udp6',
    ipProtocol : 'udp6',
    schemas: { }
  }, options);
}

function loadDefaultHandlers() {
  debug('Loading default handlers');
  this._router.handlers = {
    request: {
      lib : bootstrap.handle,
      user: (device, callback) => {
        this.emit('request', device, callback)
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
  debug('Closing bootstrap server');

  this._server.close(function() {
    this.emit('close');
    callback();
  });
};

Bootstrap.prototype.write = bootstrap.write;
Bootstrap.prototype.remove = bootstrap.remove;
Bootstrap.prototype.finish = bootstrap.finish;

module.exports.createServer = Bootstrap;
