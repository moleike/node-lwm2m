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

var debug = require('debug')('lwm2m');
var errors = require('./errors');
var Window = require('./slidingWindow');
var coap = require('coap');
var Readable = require('stream').Readable;
var setPrototypeOf = require('setprototypeof');
var url = require('url');

/**
 * Start the Lightweight M2M Server. This server module is a singleton, no multiple instances can be started (invoking
 * start multiple times without invoking stop can have unexpected results).
 *
 * @param {Object} config       Configuration object including all the information needed for starting the server.
 */

function Router(options) {
  const router = function(req, res) {
    router.handle(req, res);
  };

  setPrototypeOf(router, Router.prototype);

  router.routes = [];
  router.handlers = null;
  router.window = new Window(options.udpWindow);
  router.type = options.type || 'udp4';

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
Router.prototype.handle = function(req, res) {
  if (req.code === '0.00' && req._packet.confirmable && 
    req.payload.length === 0) {
    return res.reset();
  }

  var method = req.method;
  var mid = req._packet.messageId;

  if (this.window.contains(mid)) {
    debug('Discarding duplicate package on url `%s` with messageId `%d`',
      req.url, mid);
  } else {
    this.window.push(mid);

    debug('Handling request with method `%s` on url `%s` with messageId `%d`',
      method, req.url, mid);

    req.urlObj = url.parse(req.url);

    var handlers = this.handlers;
    var pathname = req.urlObj.pathname;

    this.routes.forEach(function(route) {
      if (method === route[0] && pathname.match(route[1])) {
        var handler = handlers[route[2]];
        handler.lib(req, res, handler.user);
        return;
      }
    });
  }
};

function isObserveAction(res) {
  var observeFlag = false;

  for (var i = 0; i < res.options.length; i++) {
    if (res.options[i].name === 'Observe') {
      observeFlag = true;
    }
  }
  return observeFlag;
}

function readResponse(res, callback) {
  var data = '';

  res.on('data', function (chunk) {
    data += chunk;
  });

  res.on('error', function(error) {
    callback(new errors.ClientResponseError(error));
  });

  res.on('end', function(chunk) {
    if (chunk) {
      data += chunk;
    }
    callback(null, res);
  });
}


/**
 * Send the COAP Request passed as a parameter. If the request contains a parameter "payload", the parameter is sent
 * as the payload of the request; otherwise, the request is sent without any payload.
 *
 * @param {Object} request          Object containing all the request information (in the Node COAP format).
 */
Router.prototype.sendRequest = function(request, callback) {
  var agent = new coap.Agent({ type: this.type }),
      req = agent.request(request),
      rs = new Readable();

  req.on('response', function(res) {
    if (isObserveAction(res)) {
      callback(null, res);
    } else {
      readResponse(res, callback);
    }
  });

  req.on('error', function(error) {
    callback(new errors.ClientConnectionError(error));
  });

  if (request.payload) {
    rs.push(request.payload);
    rs.push(null);
    rs.pipe(req);
  } else {
    req.end();
  }
};

module.exports = Router;
