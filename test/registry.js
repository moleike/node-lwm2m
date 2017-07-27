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
var lwm2m = require('../');
var utils = require('../lib/utils');
var registry, location;

describe('Device registry', function() {
  beforeEach(function(done) {
    registry = new lwm2m.Registry();

    registry.register({ 
      ep: 'test', 
      lt: 300,
    })
      .then(function(loc) {
        location = loc;
        done();
      })
      .catch(done);
  });

  describe('#register', function() {
    it('should save a new client an return its location', function() {
      return registry.register({
        ep: 'foo',
        lt: 300,
      }).should.be.eventually.a.Number();
    });

    it('should save all properties', function() {
      return registry.register({
        ep: 'foo',
        lt: 300,
        foo: 'test',
        bar: 42,
      })
        .then(function(loc) {
          return registry.get(loc);
        })
        .should.have.eventually.properties([ 
          'foo',
          'bar', 
        ]);
    });

    it('should be ok to register an existing client', function() {
      return registry.register({
        ep: 'test',
        lt: 300,
      }).should.be.eventually.a.Number();
    });

    it('should evict client when lifetime expires', function() {
      return registry.register({
        ep: 'foo',
        lt: 0,
      })
        .then(function(loc) {
          return utils.setTimeoutPromise(1, loc);
        })
        .then(function(loc) {
          return registry.get(loc);
        })
        .should.be.rejectedWith(/not found/);
    });
  });

  describe('#unregister', function() {
    it('should return the client', function() {
      return registry.unregister(location)
        .should.have.eventually.properties({ ep: 'test' });
    });

    it('should return an error if location is unknown', function() {
      return registry.unregister(123)
        .should.be.rejectedWith(/not found/);
    });
  });

  describe('#update', function() {
    it('should update client registration params', function() {
      return registry.update(location, { lt: 100 })
        .then(function(loc) {
          return registry.get(loc);
        })
        .should.have.eventually.properties({ lt: 100 });
    });

    it('should return an error if location is unknown', function() {
      return registry.update(123, { lt: 100 })
        .should.be.rejectedWith(/not found/);
    });
  });

  describe('#get', function() {
    it('should return the client by location', function() {
      return registry.get(location)
        .should.eventually.have.property('ep').eql('test');
    });

    it('should return an error if location is unknown', function() {
      return registry.get(123)
        .should.be.rejectedWith(/not found/);
    });
  });

  describe('#find', function() {
    it('should return the client by endpoint ep', function() {
      return registry.find('test')
        .should.eventually.have.property('ep').eql('test');
    });

    it('should return an error if endpoint ep is unknown', function() {
      return registry.find('foo')
        .should.be.rejectedWith(/not found/);
    });
  });
});
