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
var utils = require('./utils');

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
          sv: value.toString('base64'), 
        });
      },
      Array: function() {
        value.forEach(function(val, i) {
          append(arr, key + '/' + i, val);
        });
      },
      Date: function() {
        var timestamp = value.getTime() / 1e3 >> 0; 
        arr.push({ n: key, v: timestamp });
      },
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

  function append(obj, key, attr, data, i) {
    var types = {
      String: function() {
        obj[key] = data[i].sv;
      },
      Number: function() {
        obj[key] = data[i].v;
      },
      Boolean: function() {
        obj[key] = data[i].bv;
      },
      Buffer: function() {
        obj[key] = Buffer.from(data[i].sv, 'base64');
      },
      Date: function() {
        obj[key] = new Date(data[i].v * 1e3);
      },
      Objlnk: function() {
        var path = data[i].ov.split(':').join('/');
        var elems = data.filter(function(elem) {
          return elem.n.startsWith(path);
        });
        var inSchema = attr.schema;
        obj[key] = {};

        elems.forEach(function(elem, j) {
          var inKey = inSchema.id[elem.n.split('/')[2]];

          // skip resources not defined in schema.
          if (!inKey) {
            return;
          }

          append(obj[key], inKey, inSchema.resources[inKey], elems, j);
        });
      },
    };

    if (Array.isArray(attr.type)) {
      var id = data[i].n.split('/').slice(-1)[0];

      if (!obj[key]) {
        obj[key] = [];
      }

      append(obj[key], id, { type: attr.type[0] }, data, i);
    } else {
      (types[attr.type])();
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

  var offset = 0;

  if (obj.bn) {
    if (obj.bn === '/') {
      offset = 2;
    } else if (utils.isObject(obj.bn)) {
      offset = 1;
    } else if (utils.isInstance(obj.bn)) {
      offset = 0;
    } else {
      throw new Error('Invalid JSON payload');
    }
  }

  for (var i = 0; i < obj.e.length; ++i) {
    var key = schema.id[obj.e[i].n.split('/')[offset]];

    // skip resources not defined in schema.
    if (!key) {
      continue; 
    }

    append(result, key, schema.resources[key], obj.e, i);
  }

  return result;
}

exports.serialize = serializeToString;
exports.parse = parse;
