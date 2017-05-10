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

var async = require('async');
var errors = require('../errors');
var coapUtils = require('./coapUtils');
var coapUtils2 = require('../coapUtils');
var senml = require('../senml');
var tlv = require('../tlv');
var getMediaType = require('../mediaType').getMediaType;
var content = require('../contentFormats');
var debug = require('debug')('lwm2m');
var apply = async.apply;

function findSchema(path, schemas) {
  var objectId = path
    .split('/')
    .filter(Boolean)[0];

  return schemas['/' + objectId];
}

function handleRequest(req, res, handler) {
    var queryParams = coapUtils2.extractQueryParams(req);

    function end(req, res) {
        return function (error, result) {
            if (error) {
                debug('Bootstrap request ended up in error [%s] with code [%s]', 
                    error.name, error.code);

                res.code = error.code;
                res.end(error.name);
            } else {
                debug('Client [%s] initiated bootstrap successfully', queryParams.ep);

                res.code = '2.04';
                res.end('');
            }
        };
    }

    debug('Handling bootstrap request');

    var device = {
      ep : queryParams.ep,
      addr: req.rsinfo.address,
      port: req.rsinfo.port
    };

    async.series([
        async.apply(coapUtils2.checkMandatoryQueryParams, ['ep'], queryParams),
        async.apply(handler, device),
    ], end(req, res));

}

/**
 * Makes a Write operation over the designed resource ID of the selected device.
 */
function write(device, path, value, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    var mediaType;
    var schema = options.schema || findSchema(path, this._schemas);
    var payload;

    try {
      mediaType = getMediaType(path, value, options.format);
    } catch (e) {
      callback(e);
    }

    if (typeof value === 'object') { // object --> schema
      try {
        if (!schema) {
          throw new Error('missing schema');
        }

        switch(mediaType) {
          case content.json:
            payload = senml.serialize(value, schema);
            break;
          case content.tlv:
            payload = tlv.serialize(value, schema);
            break;
        }
      } catch (e) {
        callback(e);
      }
    } else {
      payload = value;
    }

    function createRequest(callback) {
        var request = {
            host: (this._ipProtocol === 'udp6')?'::1':'127.0.0.1',
            port: this._port,
            method: 'PUT',
            proxyUri: 'coap://' +
              (this._ipProtocol === 'udp6' ? '['+device.addr+']' : device.addr) +
              ':' + device.port,
            pathname: path,
            payload: payload,
            options: {
                'Content-Format': mediaType
            }
        };

        callback(null, request);
    }

    function processResponse(res, callback) {
        if (res.code === '2.04') {
            callback(null);
        } else {
            callback(new errors.ClientError(res.code));
        }
    }

    debug('Writting to %s in device [%s]', 
        path, device.ep);

    async.waterfall([
        createRequest.bind(this),
        coapUtils.sendRequest,
        processResponse
    ], callback);
}

function remove(device, path, callback) { 
    function createRequest(callback) {
        var request = {
            host: (this._ipProtocol === 'udp6')?'::1':'127.0.0.1',
            port: this._port,
            method: 'DELETE',
            proxyUri: 'coap://' +
              (this._ipProtocol === 'udp6' ? '['+device.addr+']' : device.addr) + 
              ':' + device.port,
            pathname: path,
        };

        callback(null, request);
    }

    function processResponse(res, callback) {
        if (res.code === '2.02') {
            callback(null);
        } else {
            callback(new errors.ClientError(res.code));
        }
    }

    debug('Deleting object %s in device [%s]', 
        path, device.ep);

    async.waterfall([
        createRequest.bind(this),
        coapUtils.sendRequest,
        processResponse
    ], callback);
}

function finish(device, callback) { 
    function createRequest(callback) {
        var request = {
            host: (this._ipProtocol === 'udp6')?'::1':'127.0.0.1',
            port: this._port,
            method: 'POST',
            proxyUri: 'coap://' + 
              (this._ipProtocol === 'udp6' ? '['+device.addr+']' : device.addr) +
              ':' + device.port,
            pathname: '/bs',
        };

        callback(null, request);
    }

    function processResponse(res, callback) {
        if (res.code === '2.04') {
            callback(null, res.payload.toString('utf8'));
        } else {
            callback(new errors.ClientError(res.code));
        }
    }

    debug('Bootstrap finish request on device [%s]', device.ep);

    async.waterfall([
        createRequest.bind(this),
        coapUtils.sendRequest,
        processResponse
    ], callback);
}

exports.handle = handleRequest;
exports.write = write;
exports.remove = remove;
exports.finish = finish;
