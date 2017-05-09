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

var content = require('./contentFormats');

function isResource(path) {
  return path
    .replace(/^\//, '')
    .split('/')
    .length === 3;
}

function isInstance(path) {
  return path
    .replace(/^\//, '')
    .split('/')
    .length === 2;
}

exports.getMediaType = function(path, value, format) {
  if (format) {
    if (format.match(/json/)) {
      return content.json;
    } else if (format.match(/tlv/)) {
      return content.tlv;
    } else if (format.match(/text/)) {
      return content.text;
    } else if (format.match(/opaque/)) {
      return content.opaque;
    }
  } else if (isInstance(path)) {
    if (typeof value === 'string') {
      return content.json;
    } else if (Buffer.isBuffer(value)) {
      return content.tlv;
    } else if (isObject(value)) {
      return content.tlv; // give it a default
    }
  } else if (isResource(path)) {
    if (Buffer.isBuffer(value)) {
      return content.opaque;
    } else {
      return content.text;
    }
  } else {
    throw new Error('Cannot get media type for ' + value +
      ' at path ' + path);
  }
};

