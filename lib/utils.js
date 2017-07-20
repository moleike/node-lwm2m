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

var errors = require('./errors');
var debug = require('debug')('lwm2m');
var senml = require('./senml');
var tlv = require('./tlv');
var content = require('./contentFormats');
var validate = require('./schema').validate;
var url = require('url');
var coap = require('coap');
var Readable = require('readable-stream').Readable;

exports.promisify = require('node-promisify');

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
    .filter(Boolean) // remove empty strings
};
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

exports.isObject = function(path) {
  return splitPath(path).length === 1;
};

exports.instanceId = function(path) {
  return splitPath(path)[1];
};

exports.isInstance = function(path) {
  return splitPath(path).length === 2;
};

exports.resourceId = function(path) {
  return splitPath(path)[2];
};

exports.isResource = function(path) {
  return splitPath(path).length === 3;
};

exports.query = function(req) {
  var obj = url.parse(req.url, true);
  return Object.assign({}, obj.query);
};

exports.validateQuery = function(query, mandatory) {
  var params = Object.keys(query);

  return mandatory.every(function(param) {
    return params.indexOf(param) >= 0;
  });
}

exports.getOption = function(res, name) {
  var index = res.options.findIndex(function(option) { 
      return option.name === name; 
    });
  
  if (index < 0)
    return;

  return res.options[index].value;
};

exports.parsePayload = function(res, schema) {
  var body;

  var contentFormat = exports.getOption(res, 'Content-Format'); 

  switch (contentFormat) {
    case content.json:
      if (schema) {
        body = senml.parse(res.payload, schema);
      } else {
        body = JSON.parse(res.payload.toString('utf8'));
      }
      break;
    case content.tlv:
      if (schema) {
        body = tlv.parse(res.payload, schema);
      } else {
        body = res.payload;
      }
      break;
    case content.opaque:
      body = res.payload;
      break;
    case content.text:
      body = res.payload.toString('utf8');
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

exports.readResponse = function(res) {
  return new Promise(function(resolve, reject) {
    var data = '';

    if (exports.getOption(res, 'Observe')) {
      resolve(res);
    }

    res.on('data', function (chunk) {
      data += chunk;
    });

    res.on('error', function(error) {
      reject(new errors.ClientResponseError(error));
    });

    res.on('end', function(chunk) {
      if (chunk) {
        data += chunk;
      }

      resolve(res)
    });
  });
};

exports.send = function(request, type) {
  var agent = new coap.Agent({ type: type });

  request.agent = agent;
  var req = coap.request(request);
  var rs = new Readable();

  return new Promise(function(resolve, reject) {
    req.on('response', function(res) {
      resolve(exports.readResponse(res));
    });

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

