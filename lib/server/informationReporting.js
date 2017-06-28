/*
 * Copyright 2017 Alexandre Moreno <alex_moreno@tutk.com>
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
var utils = require('../utils');
var content = require('../contentFormats');
var Transform = require('stream').Transform;  
var content = require('../contentFormats');

function DecodeStream(contentType) {  
  this.contentType = contentType
  Transform.call(this, { readableObjectMode: true });
}

DecodeStream.prototype = Object.create(Transform.prototype);
DecodeStream.prototype.constructor = DecodeStream;

DecodeStream.prototype._transform = function(chunk, encoding, callback) {  
  switch(this.contentType) {
    case content.text:
      this.push(chunk.toString('utf8'));
      break;
    default:
      // TODO
      this.push(chunk);
      break;
  }

  callback();
};

DecodeStream.prototype.close = function() {  
  this.push(null);
  this.emit('close');
};

/**
 * Observe changes in `path` of device with endpoint name `ep`. 
 * The notification behaviour, e.g. periodic or event-triggered reporting, is configured with the 
 * `writeAttributes` method. The callback is given the two arguments `(err, stream)`, 
 * where `stream` is a `Readable Stream`. To stop receiving notifications `close()` the stream
 * and (optionally) call `cancel()` on the same `ep` and `path` and .
 *
 * Example:
 *   
 *   server.observe('dev0', '/1024/10/1', function(err, stream) {
 *     stream.on('data', function(value) {
 *       console.log('new value %s', value);
 *     });
 *   
 *     stream.on('end', function() {
 *       console.log('stopped observing');
 *     });
 *   });
 *  
 *
 * @param {String} ep
 * @param {String} path
 * @param {Function} callback
 */
exports.observe = function(ep, path, options, callback) {
  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  // not implemented yet
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var server = this;

  var processStream = function(err, stream) {
    if (err) {
      callback(err);
      return;
    }

    var contentType = stream.headers['Content-Type']
    var decode = new DecodeStream(contentType);

    decode.on('close', function() {
      debug('closeing observe stream');
      stream.close();
    });

    callback(null, stream.pipe(decode));
  };

  debug('Observing resource %s from device %s', path, ep);

  this.sendRequest(ep, {
    method: 'GET',
    pathname: path,
    observe: true,
    options: {
      'Accept': content.text
    }
  }, processStream);
};

/**
 * Cancel an observation for `path` of device `ep`.
 *
 * @param {String} ep
 * @param {String} path
 * @param {Function} callback
 */
exports.cancel = function(ep, path, callback) {
  if (!utils.validatePath(path)) {
    throw new Error('Illegal path: `' + path + '`');
  }

  debug('Cancel observation of resource %s from device %s', 
    path, ep);

  this.sendRequest(ep, {
    method: 'GET',
    pathname: path,
    options: {
      'Accept': content.text,
      'Observe': 1
    }
  }, callback);
};
