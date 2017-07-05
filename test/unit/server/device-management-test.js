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
var server, client;
var payload = '</1>,</2>,</3>,</4>,</5>';
var ep = 'test';
var schema = lwm2m.Schema({
  foo : { id: 5, type: 'String' },
  bar : { id: 6, type: 'Number' }
});

describe('Device management' , function() {

  beforeEach(function (done) {
    server = lwm2m.createServer({ type: 'udp4' });
    client = coap.createServer({ type: 'udp4' });
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
        client.listen(res.outSocket.port, done);
      });
    });
  });

  afterEach(function(done) {
    server.close(function() {
      client.close(done);
    });
  });

  describe('#read()', function() {

    it('respond with parsed object', function (done) {
      client.on('request', function (req, res) {
        req.method.should.equal('GET');
        res.setOption('Content-Format', 'application/vnd.oma.lwm2m+json');
        res.code = '2.05';

        var rs = new Readable();
        rs.push('{"e":[');
        rs.push('{"n":"5","sv":"test"},');
        rs.push('{"n":"6","v":42}');
        rs.push(']}');
        rs.push(null);
        rs.pipe(res);
      });

      server.read(ep, '/3/4', { schema: schema },  function (err, result) {
        should.not.exist(err);
        should.exist(result);
        result.should.have.properties(['foo', 'bar']);
        done();
      });
    });

    it('respond with matching resource', function (done) {
      client.on('request', function (req, res) {
        req.method.should.equal('GET');
        res.setOption('Content-Format', 'text/plain');
        res.code = '2.05';
        res.end('test');
      });

      server.read(ep, '/3/4/5', { schema: schema },  function (err, result) {
        should.not.exist(err);
        should.exist(result);
        result.should.equal('test');
        done();
      });
    });
  });
  describe('#discover()', function() {
    it('respond with matching payload send by client', function (done) {
      client.on('request', function (req, res) {
        req.method.should.equal('GET');
        res.code = '2.05';
        res.end('test');
      });

      server.discover(ep, '/3/4/5', function (err, result) {
        should.not.exist(err);
        should.exist(result);
        result.should.equal('test');
        done();
      });
    });
  });
});
