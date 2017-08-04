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

var should = require('should'), // jshint ignore:line
  utils = require('../lib/utils');

describe('utils', function() {
  describe('#getMediaType', function() {
    it('should return text when path is a resource and value an string', function() {
      utils.getMediaType('/25/4/3', 'test')
        .should.be.equal('text/plain');

      utils.getMediaType('/25/4/3', 'test', 'text')
        .should.be.equal('text/plain');
    });
    it('should return json when path is an instance and value an string', function() {
      utils.getMediaType('/25/4', 'test')
        .should.be.equal('application/vnd.oma.lwm2m+json');

      utils.getMediaType('/25/4', 'test', 'json')
        .should.be.equal('application/vnd.oma.lwm2m+json');
    });
    it('should return octet-stream when path is a resource and value a buffer', function() {
      utils.getMediaType('/25/4/3', Buffer.from('test'))
        .should.be.equal('application/octet-stream');

      utils.getMediaType('/25/4/3', Buffer.from('test'), 'opaque')
        .should.be.equal('application/octet-stream');
    });
    it('should return tlv when path is an instance and value a buffer', function() {
      utils.getMediaType('/25/4', Buffer.from('test'))
        .should.be.equal('application/vnd.oma.lwm2m+tlv');

      utils.getMediaType('/25/4', Buffer.from('test'), 'tlv')
        .should.be.equal('application/vnd.oma.lwm2m+tlv');
    });
  });
});
