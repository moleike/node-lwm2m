/*
 * Copyright 2017 Alexandre Moreno <alex_moreno@tutk.com>
 *
 * This file is part of node-lwm2m
 *
 * node-lwm2m is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * node-lwm2m is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with node-lwm2m.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */

'use strict';

var debug = require('debug')('lwm2m');
var errors = require('../../errors');
var utils = require('../../utils');

module.exports = function(req, res) {
  var server = this;

  var user = utils.promisify(function(params, callback) {
    server.emit('bootstrapRequest', params, callback);
  });

  var query = utils.query(req);

  debug('Handling registration request');

  var promise = new Promise(function(resolve, reject) {
    if (utils.validateQuery(query, ['ep'])) {
      resolve();
    } else {
      reject(new errors.BadRequestError());
    }
  })
  .then(function() {
    return user(query);
  })
  .then(function() {
    return server._registry.register(Object.assign(query, req.rsinfo));
  })
  .then(function(location) {
    res.code = '2.04';
    res.end();
  })
  .catch(function(err) {
    res.code = err.code || '4.00'; // TODO should be 5.00 
    debug(err.message)
    res.end();
  });
};


