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
var utils = require('../utils');
var url = require('url');

module.exports = function(req, res, handler) {
  var server = this;
  var path = url.parse(req.url).pathname;
  var location = utils.splitPath(path).pop();
  var user = utils.promisify(function(params, callback) {
    server.emit('update', params, callback);
  });

  var query = utils.query(req);
  var params = Object.assign(query, { 
    payload: req.payload.toString() 
  });

  debug('Handling update registration request');

  user(params)
  .then(function() {
    return server._registry.update(location, 
      Object.assign(params, req.rsinfo));
  })
  .then(function() {
    res.code = '2.04';
    res.end();
  })
  .catch(function(err) {
    res.code = err.code || '4.00';
    debug(err.message)
    res.end();
  });
};

