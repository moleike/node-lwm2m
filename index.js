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

var coap = require('coap');
var contentFormats = require('./lib/contentFormats');
var Schema = exports.Schema = require('./lib/schema');
var debug = require('debug')('lwm2m');

contentFormats.formats.forEach(function(format) {
  coap.registerFormat(format.name, format.value);
});

process.on('unhandledRejection', function(reason) {
  debug('Unhandled rejection: ' + reason);
});

exports.schemas = [
  Schema(require('./lib/oma/security.json')),
  Schema(require('./lib/oma/server.json')),
  Schema(require('./lib/oma/acl.json')),
  Schema(require('./lib/oma/device.json')),
  ,
  ,
  Schema(require('./lib/oma/location.json'))
];

exports.createServer = require('./lib/server');
exports.bootstrap = require('./lib/server/bootstrap');
exports.Registry = require('./lib/server/registry');

