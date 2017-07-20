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
 *
 */

'use strict';

var debug = require('debug')('lwm2m');

function serializeToString(obj, schema) {
  var result = { e: [] },
      keys = Object.keys(obj);

  schema.validate(obj);

  function append(arr, key, value) {
    var types = {
      String: function() {
        arr.push({ n: key, sv: value });
      },
      Number: function() {
        arr.push({ n: key, v: value });
      },
      Boolean: function() {
        arr.push({ n: key, bv: value });
      },
      Buffer: function() {
        arr.push({ 
          n: key, 
          sv: value.toString('base64') 
        });
      },
      Array: function() {
        value.forEach(function(val, i) {
          append(arr, key + '/' + i, val);
        });
      }
    };

    function skip () {
      debug('Skipping resource with invalid type %s', typeof value);
    }

    var type = Object.prototype.toString.call(value).slice(8, -1);

    if (Buffer.isBuffer(value)) {
      type = Buffer.name;
    }

    (types[type] || skip)();
    
    return arr;
  }

  for (var i = 0; i < keys.length; ++i) {
    var key = keys[i],
        res = schema.resources[key];
    
    // skip resources not defined in schema
    if (!res) {
      debug('Resource not defined in schema: %s', key);
      continue;
    }

    append(result.e, String(res.id), obj[key]);
  }

  return JSON.stringify(result);
}

function parse(payload, schema) {
  var result = {},
      obj = {};

  function append(obj, key, type, value) {
    var types = {
      String: function() {
        obj[key] = value.sv;
      },
      Number: function() {
        obj[key] = value.v;
      },
      Boolean: function() {
        obj[key] = value.bv;
      },
      Buffer: function() {
        obj[key] = Buffer.from(value.sv, 'base64');
      },
    };


    if (Array.isArray(type)) {
      var id = value.n.split('/')[1];

      if (!obj[key]) {
        obj[key] = [];
      }

      append(obj[key], id, type[0], value);
    } else {
      (types[type])();
    }

    if (obj[key] === undefined) {
      throw new Error('JSON payload does not match ' + 
        schema.name + ' definition');
    }

    return obj;
  }

  obj = JSON.parse(payload.toString('utf8'));

  if (!Array.isArray(obj.e)) {
    throw new Error('Invalid JSON payload');
  }

  for (var i = 0; i < obj.e.length; ++i) {
    var key, type;

    key = schema.id[obj.e[i].n.split('/')[0]];

    // skip resources not defined in schema.
    if (!key) {
      continue; 
    }

    type = schema.resources[key].type;

    append(result, key, type, obj.e[i]);
  }

  return result;
}

exports.serialize = serializeToString;
exports.parse = parse;
