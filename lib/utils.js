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

var errors = require('./errors');
var senml = require('./senml');
var tlv = require('./tlv');
var content = require('./contentFormats');
var url = require('url');
var coap = require('coap');
var Readable = require('readable-stream').Readable;

exports.invoke = function(callback, promise) {
  promise
    .then(callback.bind(null, null), callback)
    .catch(function(err) { 
      setTimeout(function() { 
        throw err; 
      }); 
    });
};

exports.setTimeoutPromise = function(delay, arg) {
  return new Promise(function(resolve) {
    setTimeout(resolve, delay, arg);
  });
};

function splitPath(path) {
  return path
    .replace(/^\//g, '')
    .split('/')
    .filter(Boolean); // remove empty strings
}
exports.splitPath = splitPath;

exports.validatePath = function(path) {
  var path_ = splitPath(path).map(Number);

  function inRange(val) {
    return val < 65535 && val >= 0;
  }
  
  return path_.every(inRange) &&
    [1,2,3].indexOf(path_.length) >= 0;
};

exports.objectId = function(path) {
  return splitPath(path)[0];
};

function isObject(path) {
  return splitPath(path).length === 1;
}
exports.isObject = isObject;

exports.instanceId = function(path) {
  return splitPath(path)[1];
};

function isInstance(path) {
  return splitPath(path).length === 2;
}
exports.isInstance = isInstance;

exports.resourceId = function(path) {
  return splitPath(path)[2];
};

function isResource(path) {
  return splitPath(path).length === 3;
}
exports.isResource = isResource;

exports.query = function(req) {
  var obj = url.parse(req.url, true);
  return Object.assign({}, obj.query);
};

exports.validateQuery = function(query, mandatory, optional) {
  var params = Object.keys(query);

  var ok = mandatory.every(function(param) {
    return params.indexOf(param) >= 0;
  });

  return ok && params.every(function(param) {
    return mandatory.indexOf(param) >= 0 ||
      optional.indexOf(param) >= 0;
  });
};

exports.getOption = function(res, name) {
  var index = res.options.findIndex(function(option) { 
    return option.name === name; 
  });
  
  if (index < 0)
    return;

  return res.options[index].value;
};

exports.parsePayload = function(payload, contentFormat, schema) {
  var body;

  switch (contentFormat) {
  case content.json:
    if (schema) {
      body = senml.parse(payload, schema);
    } else {
      body = JSON.parse(payload.toString('utf8'));
    }
    break;
  case content.tlv:
    if (schema) {
      body = tlv.parse(payload, schema);
    } else {
      body = payload;
    }
    break;
  case content.opaque:
    body = payload;
    break;
  case content.text:
    body = payload.toString('utf8');
    break;
  default:
    throw new Error('Unknown content format: ' + contentFormat);
  }

  return body;
};

exports.generatePayload = function(value, schema, mediaType) {
  if (!schema) {
    throw new Error('missing schema');
  }

  schema.validate(value);

  var payload;

  switch (mediaType) {
  case content.json:
    payload = senml.serialize(value, schema);
    break;
  case content.tlv:
    payload = tlv.serialize(value, schema);
    break;
  default:
    throw new Error('Uknwown media type: ' + mediaType);
  }

  return payload;
};

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
  } else if (isInstance(path) || isObject(path)) {
    if (typeof value === 'string') {
      return content.json;
    } else if (Buffer.isBuffer(value)) {
      return content.tlv;
    } else if (typeof value === 'object') {
      return content.tlv; // give it a default
    }
  } else if (isResource(path)) {
    if (Buffer.isBuffer(value)) {
      return content.opaque;
    } else {
      return content.text;
    }
  } else {
    throw new Error('Cannot get media type for ' + 
      JSON.stringify(value) + ' at path ' + path);
  }
};

exports.send = function(request, type) {
  var agent = new coap.Agent({ type: type });
  var req = agent.request(request);
  var rs = new Readable();

  return new Promise(function(resolve, reject) {
    req.on('response', resolve);
    req.on('error', function(error) {
      reject(new errors.ClientConnectionError(error));
    });

    if (request.payload) {
      rs.push(request.payload);
      rs.push(null);
      rs.pipe(req);
    } else {
      req.end();
    }
  });
};

