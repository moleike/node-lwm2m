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

var content = require('../contentFormats');
var Transform = require('readable-stream').Transform;  

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

module.exports = DecodeStream;
