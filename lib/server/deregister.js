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

module.exports = function(req, res) {
  var server = this;
  var path = url.parse(req.url).pathname;
  var location = utils.splitPath(path).pop();
  var user = utils.promisify(function(path, callback) {
    server.emit('unregister', path, callback);
  });

  debug('Handling unregistration request');

  server._registry.unregister(location)
  .then(function(client) {
    return user(path);
  })
  .then(function() {
    res.code = '2.02';
    res.end();
  })
  .catch(function(err) {
    res.code = err.code || '4.00';
    debug(err.message)
    res.end();
  });
};

