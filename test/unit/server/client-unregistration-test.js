/*
 * Copyright 2014 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of iotagent-lwm2m-lib
 *
 * iotagent-lwm2m-lib is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-lwm2m-lib is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-lwm2m-lib.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */

'use strict';

var should = require('should');
var lwm2m = require('../../../');
var coap = require('coap');
var Readable = require('stream').Readable;
var port = 5683;
var server;
var payload = '</1>,</2>,</3>,</4>,</5>';
var ep = 'test';
var location;

describe('Client unregistration', function() {

  beforeEach(function (done) {
    server = lwm2m.createServer({ type: 'udp4' });
    server.on('error', done);
    server.on('register', function(params, accept) {
      accept();
    });

    server.listen(port, function() {
      var req = coap.request({
        host: 'localhost',
        port: port,
        method: 'POST',
        pathname: '/rd',
        query: 'ep=' + ep + '&lt=86400&lwm2m=1.0&b=U'
      });
      var rs = new Readable();
      rs.push(payload);
      rs.push(null);
      rs.pipe(req);

      req.on('response', function(res) {
        location = res.options.filter(function(option) { 
          return option.name === 'Location-Path'; 
        })[0].value;

        location.should.be.a.String();
        done();
      });
    });
  });

  afterEach(function(done) {
    server.close(done);
  });

  describe('De-registering a client', function() {
    it('should return a 2.02 Deleted', function(done) {
      var req = coap.request({
        host: 'localhost',
        port: port,
        method: 'DELETE',
        pathname: location
      });
      var params;

      server.on('unregister', function(location, callback) {
        params = location;
        callback();
      });

      req.on('response', function(res) {
        params.should.be.equal(location);
        res.code.should.equal('2.02');
        done();
      });

      req.end();
    });
  });

  describe('De-registering an unknown client', function () {
    it('should return a 4.04 Not found', function(done) {
      var req = coap.request({
        host: 'localhost',
        port: port,
        method: 'DELETE',
        pathname: '/rd/136'
      });

      server.on('unregister', function(location, callback) {
        should.fail('calling user handler for a bad request');
        callback();
      });

      req.on('response', function(res) {
        res.code.should.equal('4.04');
        done();
      });

      req.end();
    });
  });
});
