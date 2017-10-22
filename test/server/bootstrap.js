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

var should = require('should');
var lwm2m = require('../../');
var bootstrap = lwm2m.bootstrap;
var coap = require('coap');
var port = 5683;
var server, client;
var ep = 'test';

var schema = lwm2m.Schema({
  foo : { id: 5, type: 'String' },
  bar : { id: 6, type: 'Integer' },
});

describe('Bootstrap', function() {
  beforeEach(function (done) {
    server = bootstrap.createServer({ type: 'udp4' });
    server.on('error', done);
    server.listen(port, done);

    client = coap.createServer({ type: 'udp4' });
  });

  afterEach(function(done) {
    server.close(function() {
      client.close(done);
    });
  });

  describe('#request', function() {
    it('should return a 2.04 Changed', function(done) {
      server.on('bootstrapRequest', function(params, accept) {
        accept();
      });

      var req = coap.request({
        host: 'localhost',
        port: port,
        method: 'POST',
        pathname: '/bs',
        query: 'ep=' + ep,
      });

      req.end();

      req.on('response', function(res) {
        res.code.should.equal('2.04');
        done();
      });
    });

    it('should return a 4.00 Bad Request when user rejects endpoint', function(done) {
      server.on('bootstrapRequest', function(params, accept) {
        accept(new Error('unknown'));
      });

      var req = coap.request({
        host: 'localhost',
        port: port,
        method: 'POST',
        pathname: '/bs',
        query: 'ep=' + ep,
      });

      req.end();

      req.on('response', function(res) {
        res.code.should.equal('4.00');
        done();
      });
    });
  });

  describe('#write()', function() {
    beforeEach(function(done) {
      server.on('bootstrapRequest', function(params, accept) {
        accept();
      });

      var req = coap.request({
        host: 'localhost',
        port: port,
        method: 'POST',
        pathname: '/bs',
        query: 'ep=' + ep,
      });

      req.end();

      req.on('response', function(res) {
        res.code.should.equal('2.04');
        client.listen(res.outSocket.port, done);
      });
    });

    it('should send an encoded payload', function(done) {
      client.on('request', function (req, res) {
        var payload = req.payload.toString();

        req.method.should.equal('POST');

        payload.should.startWith('{"e":[');
        payload.should.match(/{"n":"5","sv":"test"}/);
        payload.should.match(/{"n":"6","v":42}/);
        payload.should.endWith(']}');

        res.code = '2.04';
        res.end();
      });

      var options = { 
        schema: schema, 
        format: 'json',
      };

      var value = {
        foo: 'test',
        bar: 42,
      };

      server.write(ep, '/3/4', value, options, function(err) {
        should.not.exist(err);
        done();
      });
    });
  });

  describe('#delete()', function() {
    beforeEach(function(done) {
      server.on('bootstrapRequest', function(params, accept) {
        accept();
      });

      var req = coap.request({
        host: 'localhost',
        port: port,
        method: 'POST',
        pathname: '/bs',
        query: 'ep=' + ep,
      });

      req.end();

      req.on('response', function(res) {
        res.code.should.equal('2.04');
        client.listen(res.outSocket.port, done);
      });
    });

    it('should delete an instance', function(done) {
      client.on('request', function (req, res) {
        req.method.should.equal('DELETE');
        res.code = '2.02';
        res.end();
      });

      server.delete(ep, '/3/4', function(err) {
        should.not.exist(err);
        done();
      });
    });

    it('should delete all the existing Object Instances', function() {
      client.on('request', function (req, res) {
        req.method.should.equal('DELETE');
        req.url.should.equal('/');
        res.code = '2.02';
        res.end();
      });

      return server.delete(ep, '/').should.be.fulfilled();
    });
  });

  describe('#finish()', function() {
    beforeEach(function(done) {
      server.on('bootstrapRequest', function(params, accept) {
        accept();
      });

      var req = coap.request({
        host: 'localhost',
        port: port,
        method: 'POST',
        pathname: '/bs',
        query: 'ep=' + ep,
      });

      req.end();

      req.on('response', function(res) {
        res.code.should.equal('2.04');
        client.listen(res.outSocket.port, done);
      });
    });

    it('should delete an instance', function() {
      client.on('request', function (req, res) {
        req.method.should.equal('POST');
        req.url.should.equal('/bs');
        res.code = '2.04';
        res.end();
      });

      return server.finish(ep).should.be.fulfilled();
    });
  });
});
