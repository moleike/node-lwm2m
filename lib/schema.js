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
 *
 */

'use strict';

var extend = require('util')._extend;

function _matches(val, type) {
  function typeOf(val) {
    return Object.prototype.toString.call(val).slice(8, -1);
  }

  type = type.name || type;

  if (type === 'Buffer') {
    return Buffer.isBuffer(val);
  }

  if (!Array.isArray(type)) {
    return type === typeOf(val);
  }

  if (Array.isArray(val) && Array.isArray(type)) {
    return _matches(val[0], type[0]);
  }

  return false;
}

function _enum(values) {
  return function(val) {
    return values.indexOf(val) !== -1;
  };
}

function _range(values) {
  return function(val) {
    return values.min <= val && val <= values.max;
  };
}

function _validateResource(res, val) {
  var ok = _matches(val, res.type);
  var check;

  if (res.enum) {
    check = _enum(res.enum);
  } else if (res.range) {
    check = _range(res.range);
  }

  if (ok && check !== undefined) {
    return check(val);
  }

  return ok;
}

/**
 * validates `obj` with `schema`.
 *
 * @param {Object} obj
 * @param {Object} schema
 * @throws Will throw an error if fails to validate
 */
var validate = function(obj, schema) {
  var keys, ok, key, res, val;

  keys = Object.keys(obj);

  if (keys.length > 1) { // not single resource
    keys = Object.keys(schema);
  }

  for (var i = 0; i < keys.length; ++i) {

    key = keys[i];
    res = extend({ required: false }, schema[key]);
    val = obj[key];

    ok = _validateResource(res, val);

    if (val !== undefined && !ok) {
      throw new TypeError('Invalid resource `' + key + '`');
    }

    if (res.required && !ok) {
      throw new TypeError('Missing resource `' + key + '`');
    }
  }
};

/**
 * validates `schema`.
 *
 * An `Schema` is a collection of Resource definitions. A Resource
 * has the following properties:

 * - `id`: the LWM2M Resource ID
 * - `type`: String | Number | Boolean | Buffer; [type] for multiple instances
 * - `enum`: values are enumerated (Optional)
 * - `range`: values are within a range (Optional)
 * - `required`: the resource is mandatory. Defaults to `false`
 *
 * Example:
 *
 *   var temperature = {
 *     sensorValue: {
 *       id: 5700,
 *       type: Number,
 *       required: true
 *     },
 *     units: {
 *       id: 5701,
 *       type: String
 *     }
 *   };
 *
 *   var lightControl = {
 *     onOff: {
 *      id : 5850,
 *      type: Boolean,
 *      required: true
 *     },
 *     dimmer: {
 *       type: Number,
 *       id: 5851,
 *       range: { min: 0, max: 100 }
 *     },
 *     units: {
 *       id: 5701,
 *       type: String
 *     }
 *   };
 *
 * @param {Object} schema
 * @throws Will throw an error if fails to validate
 */
var validateSchema = function(schema) {

  function _validResourceType(type) {
    if (Array.isArray(type)) {
     type = type[0];
    }

    type = type.name || type;

    return [
      'String'
    , 'Number'
    , 'Boolean'
    , 'Buffer'
    ].indexOf(type) > -1;
  }

  var keys = Object.keys(schema);

  for (var i = 0; i < keys.length; ++i) {

    var res = schema[keys[i]];
    var ok = true;

    if (typeof res !== 'object') {
      ok = false;
    }

    if (typeof res.id !== 'number') {
      ok = false;
    }

    if (!_validResourceType(res.type)) {
      ok = false;
    }

    if (res.range && typeof res.range !== 'object') {
      ok = false;
    }

    if (res.enum && !Array.isArray(res.enum)) {
      ok = false;
    }

    if (!ok) {
      throw new TypeError('Bad definiton `' + keys[i] + '`');
    }
  }
}

/**
 * returns an object with `schema` ids as keys,
 * and resource names as values.
 *
 * @param {Object} schema
 */
var ids = function(schema) {
  return Object.keys(schema).reduce(function(acc, key) {
    var id = schema[key].id;
    acc[id] = key;
    return acc;
  }, {});
};

exports.validate = validate;
exports.validateSchema = validateSchema;
exports.ids = ids
