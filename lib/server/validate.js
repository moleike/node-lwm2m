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

var utils = require('../utils');
var errors = require('../errors');

module.exports = function(req, res) {
  var query = utils.query(req);
  var required = [];
  var optional = ['lt', 'lwm2m', 'b'];

  if (/\/rd\?/.test(req.url)) {
    required.push('ep');
  }

  if (utils.validateQuery(query, required, optional)) {
    return Promise.resolve();
  } else {
    return Promise.reject(new errors.BadRequestError());
  }
};

