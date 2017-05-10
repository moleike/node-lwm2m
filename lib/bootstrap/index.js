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

var coapRouter = require('../coapRouter');
var bootstrap = require('../server/bootstrap');
var async = require('async');
var coapUtils = require('../server/coapUtils');
var debug = require('debug')('lwm2m');
var apply = async.apply;
var util = require('util');
var EventEmitter = require('events').EventEmitter;

function Bootstrap(options) {
  if (!(this instanceof Bootstrap)) {
    return new Bootstrap(options);
  }

  EventEmitter.call(this);

  var opts = this.defaultOptions(options);
  this.options = opts;
  this._udpWindow = opts.udpWindow;
  this._serverProtocol = opts.serverProtocol;
  this._ipProtocol = opts.ipProtocol;
  this._defaultType = opts.defaultType;
  this._schemas = opts.schemas;

  coapUtils.init(opts);
}

util.inherits(Bootstrap, EventEmitter);


Bootstrap.prototype.listen = function(port) {
  this._port = port;

  var loadDefaults = function(serverInfo, callback) {
    this._serverInfo = serverInfo;
    this.loadRoutes();
    this.loadDefaultHandlers();
    callback(null, serverInfo);
  }

  async.waterfall([
    apply(coapRouter.start, this),
    loadDefaults.bind(this)
  ], function (error, results) {
    if (error) {
      this.emit('error', error);
    } else {
      this.emit('listening');
    }
  }.bind(this));

  debug('Starting Lightweight M2M Bootstrap Server');
};


Bootstrap.prototype.defaultOptions = function(options) {
  return Object.assign({
    udpWindow: 100,
    defaultType: 'Device',
    serverProtocol : 'udp6',
    ipProtocol : 'udp6',
    schemas: { }
  }, options);
};

Bootstrap.prototype.loadDefaultHandlers = function(serverInfo, config) {
  debug('Loading default handlers');
  this._serverInfo.handlers = {
    bootstrapRequest: {
      lib : bootstrap.handle,
      user: coapRouter.defaultHandler
    }
  };
};

Bootstrap.prototype.loadRoutes = function(serverInfo) {
  debug('Loading routes');
  this._serverInfo.routes = [
      ['POST', /\/bs$/, 'bootstrapRequest']
  ];
};


Bootstrap.prototype.close = function(callback) {
  debug('Closing bootstrap server');
  coapRouter.stop(this._serverInfo, function() {
    this.emit('close');
    callback();
  });
};

Bootstrap.prototype.setHandler = function(type, handler) {
    coapRouter.setHandler(this._serverInfo, type, handler);
};

Bootstrap.prototype.write = bootstrap.write;
Bootstrap.prototype.remove = bootstrap.remove;
Bootstrap.prototype.finish = bootstrap.finish;

module.exports.createServer = Bootstrap;
