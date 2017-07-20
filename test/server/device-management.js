/*
 * Copyright 2017 Alexandre Moreno <alex_moreno@tutk.com>
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
var url = require('url');
var lwm2m = require('../../');
var coap = require('coap');
var Readable = require('readable-stream').Readable;
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
    server = lwm2m.createServer();
    client = coap.createServer();
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
        res.code.should.equal('2.01');
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
    it('should respond with parsed object', function(done) {
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

      server.read(ep, '/3/4', { schema: schema },  function(err, result) {
        should.not.exist(err);
        should.exist(result);
        result.should.have.properties(['foo', 'bar']);
        done();
      });
    });

    it('should respond with matching resource', function(done) {
      client.on('request', function (req, res) {
        req.method.should.equal('GET');
        res.setOption('Content-Format', 'text/plain');
        res.code = '2.05';
        res.end('test');
      });

      server.read(ep, '42/3/5', { schema: schema },  function(err, result) {
        should.not.exist(err);
        should.exist(result);
        result.should.equal('test');
        done();
      });
    });

    it('should read current time in device object', function(done) {
      client.on('request', function (req, res) {
        req.method.should.equal('GET');
        res.setOption('Content-Format', 'application/vnd.oma.lwm2m+json');
        res.code = '2.05';

        var rs = new Readable();
        rs.push('{"e":[');
        rs.push('{"n":"13","v":42}');
        rs.push(']}');
        rs.push(null);
        rs.pipe(res);
      });

      server.read(ep, '/3/0', function(err, result) {
        should.not.exist(err);
        should.exist(result);
        result.should.have.properties({ currentTime: 42 })        
        done();
      });
    });

    it('should respond with an 4.04 when resource not found', function(done) {
      client.on('request', function (req, res) {
        req.method.should.equal('GET');
        res.code = '4.04';
        res.end('');
      });

      server.read(ep, '42/3/5', { schema: schema },  function(err) {
        should.exist(err);
        err.should.have.property('code').eql('4.04');
        done();
      });
    });

    it('should respond with an 4.04 when client not found', function(done) {
      server.read('unknown', '42/3/5', { schema: schema },  function(err) {
        should.exist(err);
        err.should.have.property('code').eql('4.04');
        done();
      });
    });

    it('should throw when missing/invalid schema', function() {
      server.read.bind(server, ep, '42/3/5').should
        .throw(TypeError, { message: 'Illegal schema' });
    });

    it('should throw when path is nonsense', function() {
      server.read.bind(server, ep, '/', { schema: schema }).should
        .throw(/Illegal path/);
      server.read.bind(server, ep, 'foo', { schema: schema }).should
        .throw(/Illegal path/);
    });
  });

  describe('#write()', function() {
    it('should update current time in device object', function(done) {
      client.on('request', function (req, res) {
        var payload = req.payload.toString();

        req.method.should.equal('POST');

        payload.should.startWith('{"e":[');
        payload.should.match(/{"n":"13","v":42}/);
        payload.should.endWith(']}');

        res.code = '2.04';
        res.end();

        done();
      });

      var value = {
        currentTime: 42
      };

      var options = {
        format: 'json'
      };

      server.write(ep, '/3/0', value, options);
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
        format: 'json'
      };

      var value = {
        foo: 'test',
        bar: 42
      };

      server.write(ep, '/3/0', value, options, function(err) {
        should.not.exist(err);
        done();
      });
    });
  });

  describe('#discover()', function() {
    it('should respond with matching payload sent by client', function(done) {
      client.on('request', function (req, res) {
        req.method.should.equal('GET');
        res.code = '2.05';
        res.end('test');
      });

      server.discover(ep, '42/3/5', function(err, result) {
        should.not.exist(err);
        should.exist(result);
        result.should.equal('test');
        done();
      });
    });

    it('should throw when path is nonsense', function() {
      server.discover.bind(server, ep, '/').should
        .throw(/Illegal path/);
      server.discover.bind(server, ep, 'foo').should
        .throw(/Illegal path/);
    });
  });

  describe('#writeAttributes()', function() {
    it('should send query matching attributes', function(done) {
      client.on('request', function (req, res) {
        var attr = url
          .parse(req.url).query
          .split('&')
          .reduce(function(attr, cur) { 
            var pair = cur.split('='); 
            attr[pair[0]] = pair[1]; 
            return attr 
          }, {});

        attr.should.have.keys('pmin', 'pmax', 'lt');
        req.method.should.equal('PUT');
        res.code = '2.04';
        res.end();
      });

      var attr = { pmin: 1, pmax: 5, lt: 5 };

      server.writeAttributes(ep, '42/3/5', attr, function(err, result) {
        should.not.exist(err);
        done();
      });
    });

  });

  describe('#delete()', function() {
    it('should delete an instance', function(done) {
      client.on('request', function (req, res) {
        req.method.should.equal('DELETE');
        res.code = '2.02';
        res.end();
      });

      server.delete(ep, '/3/4', function(err, result) {
        should.not.exist(err);
        done();
      });
    });

    it('should return an error if path not an instance', function() {
      server.delete.bind(server, ep, '42/3/5').should.throw();
    });
  });

  describe('#execute()', function() {
    it('should send a POST request to a resource', function(done) {
      client.on('request', function (req, res) {
        req.method.should.equal('POST');
        req.payload.toString().should.equal('test');
        res.code = '2.04';
        res.end();
      });

      server.execute(ep, '42/3/5', 'test', function(err) {
        should.not.exist(err);
        done();
      });
    });
  });

});
