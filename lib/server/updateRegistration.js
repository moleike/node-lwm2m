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

var async = require('async'),
    debug = require('debug')('lwm2m'),
    utils = require('../utils'),
    apply = async.apply;

/**
 *  Generates the end of request handler that will generate the final response to the COAP Client.
 */
function endUpdate(req, res) {
  return function (error, result) {
    if (error) {
      debug('Registration request ended up in error [%s] with code [%s]', error.name, error.code);

      res.code = error.code;
      res.end(error.message);
    } else {
      debug('Update registration request ended successfully');

      res.code = '2.04';
      res.end('');
    }
  };
}

/**
 * Updates the lifetime and address of the Device.
 *
 * @param {Object} req              Arriving COAP Request to be processed.
 * @param {Object} queryParams      Object containing all the query parameters.
 */
function updateRegister(req, queryParams, callback) {
  debug('Updating device register with lifetime [%s] and address [%s].',
      queryParams.lt, req.rsinfo.address);

  var params = {
    address: req.rsinfo.address,
    port: req.rsinfo.port,
    creationDate: Date.now()
  };

  if (queryParams.lt)
    params.lifetime = queryParams.lt;

  if (req.payload.length > 0)
    parmas.payload = req.payload.toString();

  callback(null, params);
}

/**
 * Parse the pathname of the request to extract the device id and return it through the callback.
 *
 * @param {Object} req           Arriving COAP Request to be processed.
 */
function parsePath(req, callback) {
  var pathElements = req.urlObj.pathname.split('/');
  callback(null, pathElements[2]);
}

/**
 * Invoke the user handler for this operation with the updated object as its only argument.
 *
 * @param {Function} handler        User handler for the update registration.
 * @param {String} payload          String representation of the update payload.
 * @param {Object} updatedObj       The updated Device object.
 */
function applyHandler(queryParams, payload, handler, callback) {
  var params = Object.assign({}, queryParams);
  params.payload = payload
  handler(params, callback);
}

/**
 * Handle the registration operation.
 *
 * @param {Object} req          Arriving COAP Request to be handled.
 * @param {Object} res          Outgoing COAP Response.
 * @param {Function} handler    User handler to be executed if everything goes ok.
 */
exports.handle = function(req, res, handler) {
  debug('Handling update registration request');
  var registry = this.getRegistry();

  async.series([
    apply(utils.extractQueryParams, req),
    apply(parsePath, req)
  ], function (error, extractedData) {
    if (error) {
      endUpdate(req, res)(error);
    } else {
      async.waterfall([
        apply(applyHandler, extractedData[0], req.payload.toString(), handler),
        apply(updateRegister, req, extractedData[0]),
        registry.update.bind(registry, extractedData[1])
      ], endUpdate(req, res));
    }
  });
};
