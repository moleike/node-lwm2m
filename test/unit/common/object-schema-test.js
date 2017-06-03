/*
 * Copyright 2017 Telefonica Investigación y Desarrollo, S.A.U
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
 *
 * Author: Alexandre Moreno <alex_moreno@tutk.com>
 */

'use strict';

var should = require('should'), // jshint ignore:line
    Schema = require('../../../lib/schema');

describe('LWM2M Object Schema', function() {
  describe('constructor', function() {

    it('should not throw on a valid schema', function() {
      var def = {
        a: { type: String, id: 0 },
        b: { type: Number, id: 1 },
        c: { type: [Boolean], id: 2 },
        d: { type: Buffer, id:3 }
      };

      function validate() {
        return new Schema(def);
      }
      
      validate.should.not.throw();
    });

    it('should throw on invalid types', function() {
      var def = {
        a: { type: String, id: 0 },
        b: { type: Date, id: 1 }
      };

      function validate() {
        return new Schema(def);
      }
      
      validate.should.throw(TypeError);
    });

    it('should throw on invalid resources', function() {
      var def = {
        a: { type: String, id: 0 },
        b: 'foo'
      };

      function validate() {
        return new Schema(def);
      }
      
      validate.should.throw(TypeError);
    });
  });

  describe('validate', function() {

    it('should be ok when an object matches an schema', function() {
      var schema = new Schema({
        a: { type: String, id: 0 },
        b: { type: Number, id: 1 }
      });

      function validate() {
        return schema.validate({ a: 'foo', b: 3 });
      }
      
      validate.should.not.throw();
    });

    it('should throw when an object does not match schema', function() {
      var schema = new Schema({
        a: { type: String, id: 0 },
        b: { type: Number, id: 1 },
      });

      function validate() {
        return schema.validate({ a: 'foo', b: false });
      }
      
      validate.should.throw(TypeError);

      function validate2() {
        return schema.validate({ a: 'foo', b: [1,2,3] });
      }
      
      validate2.should.throw(TypeError);
    });

    it('should throw when missing a required resource', function() {
      var schema = new Schema({
        a: { type: String, id: 0 },
        b: { type: Number, id: 1, required: true },
        c: { type: Boolean, id: 1 }
      });

      function validate() {
        return schema.validate({ a: 'foo', c: false });
      }
      
      validate.should.throw(TypeError);
    });

    it('should throw when a value is not within bounds', function() {
      var def = {
        b: { type: Number, id: 1 },
      };

      def.b.range = { 
        min: 1, 
        max: 10 
      };

      var schema = new Schema(def);

      function validate() {
        return schema.validate({ b: 11 });
      }
      
      validate.should.throw(TypeError);

    });

    it('should throw when an enumerated resource is not match', function() {
      var def = {
        a: { type: String, id: 0 },
      };

      def.a.enum = [
        'bar', 
        'baz', 
        'qux'
      ];

      var schema = new Schema(def);

      function validate() {
        return schema.validate({ a: 'foo' });
      }
      
      validate.should.throw(TypeError);

    });
  });
});

