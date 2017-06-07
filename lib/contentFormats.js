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

var text = 'text/plain';
var link = 'application/link-format';
var opaque = 'application/octet-stream';
var tlv = 'application/vnd.oma.lwm2m+tlv';
var json = 'application/vnd.oma.lwm2m+json';

var formats = [
  { name: text, value : 0 }, 
  { name: link, value : 40 },
  { name: opaque, value : 42 },
  { name: tlv, value : 11542 },
  { name: json, value : 11543 }
];

module.exports = {
  text: text,
  link: link,
  opaque: opaque,
  tlv: tlv,
  json: json,
  formats: formats
};

