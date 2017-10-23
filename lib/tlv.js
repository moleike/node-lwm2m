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

var debug = require('debug')('lwm2m');

/*
 * length in bytes of a number
 */
function byteLength(val) {
  if (val < 2) {
    return 1;
  }
  return Math.ceil(Math.log(val) * Math.LOG2E / 8);
}

function length(val) {
  // integer size: 1, 2, 4 or 8 bytes.
  function size(val) {
    var v = byteLength(val);
    v--;
    v |= v >>> 1;
    v |= v >>> 2;
    v++;
    return v;
  }

  var type = Object.prototype.toString.call(val).slice(8, -1);

  switch(type) {
  case 'Number':
    return (val % 1 === 0 ? size(val) : 8);
  case 'String':
  case 'Uint8Array':
  case 'Buffer':
    return val.length;
  case 'Boolean':
    return 1;
  case 'Date':
    return size(val.getTime() / 1e3 >> 0);
  default:
    return 0;
  }
}

function readHeader(buf, offset, tlv) {
  var type, id, len;
  var header;
    
  header = buf.readUInt8(offset);
  offset += 1;

  type = header >>> 6;

  if (header & 0x20) {
    id = buf.readUInt16BE(offset);
    offset += 2;
  } else {
    id = buf.readUInt8(offset);
    offset += 1;
  }

  len = header & 0x7;

  if (!len) {
    switch ((header & 0x18) >>> 3) {
    case 1:
      len = buf.readUInt8(offset);
      offset += 1;
      break;
    case 2:
      len = buf.readUInt16BE(offset);
      offset += 2;
      break;
    case 3:
      len = buf.readUInt16BE(offset);
      len = buf.readUInt8(offset);
      offset += 3;
      break;
    }
  }

  tlv.len = len;
  tlv.id = id;
  tlv.type = type;

  return offset;
}

function writeHeader(buf, offset, idType, id, len) {
  function tlvType(type, id, len) {
    var byte = type << 6;

    if (id > 0xff) {
      byte |=  0x1 << 5;
    }

    if (len < 8) {
      byte |= len;
    } else {
      byte |= length(len) << 3;
    }

    return byte;
  }

  var type = tlvType(idType, id, len);

  /* type (8-bits masked field) */
  buf.writeUInt8(type, offset);
  offset += 1;

  /* identifier (8-bit or 16-bit UInt) */
  if (type & 0x20) {
    buf.writeUInt16BE(id, offset);
    offset += 2;
  } else {
    buf.writeUInt8(id, offset);
    offset += 1;
  }
  
  /* length (0-24-bit UInt) */
  if (type & 0x18) {
    switch (length(len)) {
    case 3:
      buf.writeUInt8(len >>> 0x10 & 0xff, offset);
      offset += 1;
      /* falls through */
    case 2:
      buf.writeUInt8(len >>> 0x08 & 0xff, offset);
      offset += 1;
      /* falls through */
    case 1:
      buf.writeUInt8(len & 0xff, offset);
      offset += 1;
      break;
    default:
      throw new Error('Invalid resource `' + id + '`');
    }
  }

  return offset;
}

function serialize(obj, schema) {
  var buf = Buffer.alloc(16 * 1024 /*1024*/);
  var keys = Object.keys(obj);

  schema.validate(obj);

  function append(buf, offset, len, value, type) {
    var types = {
      String: function() {
        buf.write(value, offset, buf.length - offset, 'utf8');
        return offset += len;
      },
      Integer: function() {
        buf.writeIntBE(value, offset, len);
        return offset += len;
      },
      Float: function() {
        buf.writeDoubleBE(value, offset);
        return offset += len;
      },
      Boolean: function() {
        buf.writeInt8(value, offset);
        return offset += len;
      },
      Opaque: function() {
        value.copy(buf, offset);
        return offset += len;
      },
      Time: function() {
        // convert date to timestamp in seconds
        var timestamp = value.getTime() / 1e3 >> 0; 
        buf.writeIntBE(timestamp, offset, len);
        return offset += len;
      },
    };

    function skip () {
      debug('Skipping resource with invalid type %s', type);
      return offset;
    }

    return (types[type] || skip)();
  }

  function writeRecord(buf, offset, key) {
    var res = schema.resources[key];
    var val = obj[key];
    var len;

    if (Array.isArray(res.type)) {
      var tmp = Buffer.alloc(1024);
      var arrLen = 0;

      val.forEach(function(elem, i) {
        len = length(elem);
        arrLen = writeHeader(tmp, arrLen, 1, i, len);
        arrLen = append(tmp, arrLen, len , elem, res.type[0]);
      });

      offset = writeHeader(buf, offset, 2, res.id, arrLen);
      tmp.copy(buf, offset, 0, arrLen);
      offset += arrLen;
    } else {
      len = length(val);

      offset = writeHeader(buf, offset, 3, res.id, len);
      offset = append(buf, offset, len, val, res.type);
    }

    return offset;
  }

  var len = 0;

  for (var i = 0; i < keys.length; ++i) {
    var key = keys[i];
 
    // skip resources not defined in schema
    if (!schema.resources[key]) {
      continue;
    }

    len = writeRecord(buf, len, key);
  }

  return buf.slice(0, len);
}

function parse(payload, schema) {
  function append(obj, key, type, payload, pos, len) {
    var types = {
      String: function() {
        obj[key] = payload.toString('utf8', pos, pos + len); 
        pos += len;
        return pos;
      },
      Integer: function() {
        obj[key] = payload.readIntBE(pos, len);
        pos += len;
        return pos;
      },
      Float: function() {
        obj[key] = payload.readDoubleBE(pos);
        pos += 8;
        return pos;
      },
      Boolean: function() {
        obj[key] = payload.readUInt8(pos) ? true : false;
        pos += 1;
        return pos;
      },
      Opaque: function() {
        var buf = Buffer.alloc(len);
        payload.copy(buf, 0, pos, pos + len);
        obj[key] = buf;

        pos += len;
        return pos;
      },
      Time: function() {
        var timestamp = payload.readIntBE(pos, len);
        obj[key] = new Date(timestamp * 1e3);
        pos += len;
        return pos;
      },
    };

    if (Array.isArray(type)) {
      var end = pos + len;
      var tlv = {};
      obj[key] = [];

      while (pos < end) {
        pos = readHeader(payload, pos, tlv);
        pos = append(obj[key], tlv.id, type[0], payload, pos, tlv.len);
      }

      return pos;
    } else {
      return (types[type])();
    }

  }

  var result = {};
  var pos = 0;
  var tlv = {}, key, type;

  while (pos < payload.length) {

    pos = readHeader(payload, pos, tlv);
    key = schema.id[tlv.id];

    // skip resources not defined in schema.
    if (!key) {
      debug('Resource not defined in schema: %s', key);
      continue; 
    }

    type = schema.resources[key].type;

    pos = append(result, key, type, payload, pos, tlv.len);
  }

  return result;
}

exports.serialize = serialize;
exports.parse = parse;
