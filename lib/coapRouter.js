/*
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

var debug = require('debug')('lwm2m');
var errors = require('./errors');
var Window = require('./slidingWindow');

function defaultHandler() {
    var callback = null;

    for (var i=0; i < arguments.length; i++) {
        if (arguments[i] instanceof Function) {
            callback = arguments[i];
        }
    }

    callback();
}

/**
 * Start the Lightweight M2M Server. This server module is a singleton, no multiple instances can be started (invoking
 * start multiple times without invoking stop can have unexpected results).
 *
 * @param {Object} config       Configuration object including all the information needed for starting the server.
 */

function Router(options) {
  const router = function(req, res) {
    router.dataHandler(req, res);
  };

  Object.setPrototypeOf(router, Router.prototype);

  router.routes = [];
  router.handlers = null;
  router.window = new Window(options._udpWindow || 100);

  return router;
}

/**
 * Handles the arrival of a request to the LWTM2M Server. To do so, it loops through the routes table, trying to match
 * the pathname and method of the request to an existing route. If a route matches, and the route has a handler,
 * the handler is invoked with the request, response and user handler for that operation. Otherwise, a 4.04 error is
 * returned.
 *
 * @param {Object} this      Object containing all the information of the current server.
 */
Router.prototype.dataHandler = function(req, res) {
  if (req.code === '0.00' && req._packet.confirmable && req.payload.length === 0) {
    res.reset();
  } else if (this.window.contains(req._packet.messageId)) {
    debug('Discarding duplicate package [%s] on url [%s] with messageId [%d]',
        req.method, req.url, req._packet.messageId);
  } else {
    this.window.push(req._packet.messageId);

    debug('Handling request with method [%s] on url [%s] with messageId [%d]',
      req.method, req.url, req._packet.messageId);

    req.urlObj = require('url').parse(req.url);

    for (var i in this.routes) {
      if (req.method === this.routes[i][0] && req.urlObj.pathname.match(this.routes[i][1])) {
        this.handlers[this.routes[i][2]].lib(req, res, this.handlers[this.routes[i][2]].user);
        return;
      }
    }
  }
};

module.exports = Router;
