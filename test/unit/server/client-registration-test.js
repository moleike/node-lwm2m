/*
 * Copyright 2017 Alexandre Moreno <alex_moreno@tutk.com>
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

describe('Client registration', function() {

  beforeEach(function (done) {
    server = lwm2m.createServer({ type: 'udp4' });
    server.on('error', done);
    server.listen(port, done);
  });

  afterEach(function(done) {
    server.close(done);
  });

  describe('when missing endpoint name in request', function() {
    it('should fail with a 4.00 Bad Request', function(done) {
      var req = coap.request({
        host: 'localhost',
        port: port,
        method: 'POST',
        pathname: '/rd',
        query: 'lt=86400&lwm2m=1.0&b=U'
      });

      server.on('register', function(params, accept) {
        accept();
      });

      req.on('response', function(res) {
        res.code.should.equal('4.00');
        done();
      });

      var rs = new Readable();
      rs.push(payload);
      rs.push(null);
      rs.pipe(req);
    });
  });

  describe('when missing lifetime name in request', function () {
    it('should return a 2.01 Created', function(done) {
      var req = coap.request({
        host: 'localhost',
        port: port,
        method: 'POST',
        pathname: '/rd',
        query: 'ep=test&lwm2m=1.0&b=U'
      });

      server.on('register', function(params, accept) {
        accept();
      });

      req.on('response', function(res) {
        res.code.should.equal('2.01');
        done();
      });

      var rs = new Readable();
      rs.push(payload);
      rs.push(null);
      rs.pipe(req);
    });
  });

  describe('when a valid request', function () {
    it('should return a 2.01 Created', function(done) {
      var req = coap.request({
        host: 'localhost',
        port: port,
        method: 'POST',
        pathname: '/rd',
        query: 'ep=test&lt=86400&lwm2m=1.0&b=U'
      });

      server.on('register', function(params, accept) {
        accept();
      });

      req.on('response', function(res) {
        res.code.should.equal('2.01');
        done();
      });

      var rs = new Readable();
      rs.push(payload);
      rs.push(null);
      rs.pipe(req);
    });

    it('should emit register event with query params', function (done) {
      var req = coap.request({
        host: 'localhost',
        port: port,
        method: 'POST',
        pathname: '/rd',
        query: 'ep=test&lt=86400&lwm2m=1.0&b=U'
      });
      var query = {};
      var payload;

      server.on('register', function(params, accept) {
        query = params;
        payload = params.payload;
        accept();
      });

      req.on('response', function(res) {
        res.code.should.equal('2.01');
        query.should.have.properties(['ep', 'lt', 'lwm2m', 'b']);
        payload.should.be.a.String();
        done();
      });

      var rs = new Readable();
      rs.push(payload);
      rs.push(null);
      rs.pipe(req);
    });

    it('should set Location-Path Option', function (done) {
      var req = coap.request({
        host: 'localhost',
        port: port,
        method: 'POST',
        pathname: '/rd',
        query: 'ep=test&lt=86400&lwm2m=1.0&b=U'
      });

      server.on('register', function(params, accept) {
        accept();
      });

      req.on('response', function(res) {
        res.options.length.should.equal(1);
        res.options[0].name.should.equal('Location-Path');
        res.options[0].value.should.match(/rd\/.*/);
        done();
      });

      var rs = new Readable();
      rs.push(payload);
      rs.push(null);
      rs.pipe(req);
    });
  });

  describe('when a valid request but unknown endpoint', function () {
    it('should fail with a 4.00 Bad Request', function(done) {
      var req = coap.request({
        host: 'localhost',
        port: port,
        method: 'POST',
        pathname: '/rd',
        query: 'ep=test&lt=86400&lwm2m=1.0&b=U'
      });

      server.on('register', function(params, accept) {
        accept(new Error('unknown'));
      });

      req.on('response', function(res) {
        res.code.should.equal('4.00');
        done();
      });

      var rs = new Readable();
      rs.push(payload);
      rs.push(null);
      rs.pipe(req);

    });
  });

});
