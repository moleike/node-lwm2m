/*
 * Copyright 2014 Telefonica Investigación y Desarrollo, S.A.U
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

module.exports = {
  BadRequestError: function(message) {
    this.name = 'BAD_REQUEST_ERROR';
    this.message = 'The request was not build correctly: ' + message;
    this.code = '4.00';
  },
  DeviceNotFound: function() {
    this.name = 'DEVICE_NOT_FOUND';
    this.message = 'Device not found';
    this.code = '4.04';
  },
  ObjectNotFound: function(path) {
    this.name = 'OBJECT_NOT_FOUND';
    this.message = 'The resource @' + path + ' was not found';
    this.code = '4.04';
  },
  UnsupportedAttributes: function () {
    this.name = 'UNSUPPORTED_ATTRIBUTES';
    this.message = 'Unsupported attributes';
    this.code = '4.00';
  },
  ClientError: function(code) {
    this.name = 'CLIENT_ERROR';
    this.message = 'Error code recieved from the client: ' + code;
    this.code = code;
  },
  ClientConnectionError: function(msg) {
    this.name = 'CLIENT_CONNECTION_ERROR';
    this.message = 'There was an error sending a request to the client: ' + msg;
    this.code = '5.01';
  },
  ClientResponseError: function(msg) {
    this.name = 'CLIENT_RESPONSE_ERROR';
    this.message = 'Error received while waiting for a client response: ' + msg;
    this.code = '5.01';
  },
};

