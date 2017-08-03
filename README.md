# node-lwm2m

> an implementation of the Open Mobile Alliance's Lightweight M2M protocol (LWM2M).

[![build status][travis-image]][travis-url]
[![build status][appveyor-image]][appveyor-url]
[![coverage status][coveralls-image]][coveralls-url]

[travis-image]: https://img.shields.io/travis/moleike/node-lwm2m/develop.svg
[travis-url]: https://travis-ci.org/moleike/node-lwm2m
[appveyor-image]: https://img.shields.io/appveyor/ci/moleike/node-lwm2m/develop.svg
[appveyor-url]: https://ci.appveyor.com/project/moleike/node-lwm2m
[coveralls-url]: https://coveralls.io/github/moleike/node-lwm2m?branch=develop
[coveralls-image]: https://coveralls.io/repos/github/moleike/node-lwm2m/badge.svg?branch=develop

[node-lwm2m][self] is a fork of @telefonicaid's [lwm2m-node-lib](https://github.com/telefonicaid/lwm2m-node-lib), but adds missing features in the original project required for a compliant implementation. Considerable work has been done so that it is now a distinct project.

[self]: https://github.com/moleike/node-lwm2m.git

## What is LWM2M?

LWM2M is a profile for device services based on CoAP. LWM2M defines a simple object model and a number of interfaces and operations for device management.

## Install

    npm install --save lwm2m

## Synopsis

```js
var server = require('lwm2m').createServer();

server.on('register', function(params, accept) {
  setImmediate(function() {
    server
    .read(params.ep, '3/0')
    .then(function(device) {
      console.log(JSON.stringify(device, null, 4));
    })
  });
  accept();
});

server.listen(5683);
```

## API

-   [schemas](#schemas)
-   [createServer](#createserver)
-   [bootstrap#createServer](#bootstrapcreateserver)
-   [Schema](#schema)
    -   [validate](#validate)
-   [Server](#server)
    -   [read](#read)
    -   [write](#write)
    -   [execute](#execute)
    -   [discover](#discover)
    -   [writeAttributes](#writeattributes)
    -   [create](#create)
    -   [delete](#delete)
    -   [observe](#observe)
    -   [cancel](#cancel)
-   [bootstrap#Server](#bootstrapserver)
    -   [write](#write-1)
    -   [delete](#delete-1)
    -   [finish](#finish)
-   [Registry](#registry)
    -   [\_find](#_find)
    -   [\_get](#_get)
    -   [\_save](#_save)
    -   [\_update](#_update)
    -   [\_delete](#_delete)

## schemas

Schemas for OMA-defined objects.
See [oma](lib/oma).

## createServer

Returns **[Server](#server)** object

## bootstrap#createServer

Returns **[bootstrap#Server](#bootstrapserver)** object

## Schema

Schema constructor.

An `Schema` describes the shape of an [`IPSO object`](https://www.ipso-alliance.org/). 
An Object is a collection of resources with the following properties:

-   `id`: the Resource ID
-   `type`: String | Number | Boolean | Buffer; [type] for multiple instances
-   `enum`: values are enumerated (Optional)
-   `range`: values are within a range (Optional)
-   `required`: the resource is mandatory. Defaults to `false`

See [oma](lib/oma) directory for default definitions.

**Parameters**

-   `resources` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

**Examples**

```javascript
// IPSO temperature sensor
var temperature = new Schema({
  sensorValue: {
    id: 5700,
    type: Number,
    required: true
  },
  units: {
    id: 5701,
    type: String
  }
});

// IPSO light controller
var lightControl = new Schema({
  onOff: {
   id : 5850,
   type: Boolean,
   required: true
  },
  dimmer: {
    type: Number,
    id: 5851,
    range: { min: 0, max: 100 }
  },
  units: {
    id: 5701,
    type: String
  }
});

// Bad schema
var schema = new Schema({
  a: { type: String, id: 0 },
  b: { type: Error, id: 1 },
}); // throws TypeError
```

-   Throws **any** Will throw an error if fails to validate

### validate

validates `obj` with `schema`.

**Parameters**

-   `obj` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

**Examples**

```javascript
var schema = new Schema({
  a: { type: String, id: 0 },
  b: { type: Buffer, id: 1 },
});

schema.validate({ 
  a: 'foo', 
  b: Buffer.from('bar'),
}); // OK

schema.validate({ 
  a: 'foo', 
  b: 'bar', 
}); // Throws error
```

-   Throws **any** Will throw an error if fails to validate

## Server

**Extends EventEmitter**

Server constructor.

Events:

-   `register`: device registration request.
-   `update`: device registration update.
-   `unregister`: device unregistration.

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)?** 
    -   `options.type` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** IPv4 (udp4) or IPv6 (udp6) connections (optional, default `'upd6'`)
    -   `options.piggybackReplyMs` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** milliseconds to wait for a piggyback response (optional, default `50`)
    -   `options.registry` **[Registry](#registry)** impl. of CoRE Resource Directory (optional, default `Registry`)

### read

Read `path` on device with endpoint name `endpoint`. The optional callback is given
the two arguments `(err, res)`, where `res` is parsed using `schema`.

Note:

_If no schema is provided will return a `Buffer` if the payload is `TLV`-encoded
or opaque, or an `String` otherwise._

**Parameters**

-   `endpoint` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** client endpoint name
-   `path` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** either an LWM2M Object instance or resource
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)?** 
    -   `options.schema` **[Schema](#schema)** defining resources.
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)?** 

**Examples**

```javascript
var schema = Schema({
  test: { id: 1, type: Number }
});

server.read('test', '/1024/11', { schema }, function(err, res) {
  assert(res.hasOwnProperty('test'));
  assert(typeof res.test == 'number');
});
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;([Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object) \| [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) \| [Buffer](https://nodejs.org/api/buffer.html) \| [number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number))>** a promise of the eventual value

### write

Write `value` into `path` of device with endpoint name `endpoint`.
For writing Object Instances, an schema is required.

Note:

_schemas can be globally added to `lwm2m.schemas`._

**Parameters**

-   `endpoint` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** client endpoint name
-   `path` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `value` **([Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object) \| [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) \| [Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) \| [Buffer](https://nodejs.org/api/buffer.html))** 
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.format` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** media type. (optional, default `'tlv'`)
    -   `options.schema` **[Schema](#schema)?** schema to serialize value.
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)?** 

**Examples**

```javascript
var schema = Schema({
  foo : { 
    id: 5, 
    type: 'String' 
  },
  bar : { 
    id: 6, 
    type: 'Number' 
  },
});

var options = { 
  schema: schema, 
  format: 'json',
};

var value = {
  foo: 'test',
  bar: 42,
};

var promise = server.write('test', '/42/0', value, options)
var promise = server.write('test', '/42/0/5', 'test')
var promise = server.write('test', '/42/0/6', 42)

// add schema for Object ID 42 globally.
lwm2m.schemas[42] = schema;

var promise = server.write('test', '/42/0', value)
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

### execute

Makes an Execute operation over the designed resource ID of the selected device.

**Parameters**

-   `endpoint` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** client endpoint name
-   `path` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `value` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

### discover

Execute a discover operation for the selected resource.

**Parameters**

-   `endpoint` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** client endpoint name
-   `path` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)>** a promise with an strng in link-format

### writeAttributes

Write `attributes` into `path` of endpoint `endpoint`.

**Parameters**

-   `endpoint` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** client endpoint name
-   `path` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `attributes` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)?** 

**Examples**

```javascript
var attr = {
  "pmin": 5,
  "pmax": 10
};

server.writeAttributes('dev0', '3303/0/5700', attr, function(err, res) {
   assert.ifError(err);
});
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

### create

Create a new LWM2M Object for `path`, where path is an Object ID.

**Parameters**

-   `endpoint` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** client endpoint name
-   `path` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `value` **([Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object) \| [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) \| [Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) \| [Buffer](https://nodejs.org/api/buffer.html))** 
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)?** 
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)?** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

### delete

Deletes the LWM2M Object instance in `path` of endpoint `endpoint`

**Parameters**

-   `endpoint` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** client endpoint name
-   `path` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)?** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

### observe

Observe changes in `path` of device with endpoint name `endpoint`. 
The notification behaviour, e.g. periodic or event-triggered reporting, is configured with the 
`writeAttributes` method. The callback is given the two arguments `(err, stream)`, 
where `stream` is a `Readable Stream`. To stop receiving notifications `close()` the stream
and (optionally) call `cancel()` on the same `endpoint` and `path` and .

**Parameters**

-   `endpoint` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** client endpoint name
-   `path` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `options`  
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)?** 

**Examples**

```javascript
server.observe('dev0', '/1024/10/1', function(err, stream) {
  stream.on('data', function(value) {
    console.log('new value %s', value);
  });

  stream.on('end', function() {
    console.log('stopped observing');
  });
});
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

### cancel

Cancel an observation for `path` of device `endpoint`.

**Parameters**

-   `endpoint` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** client endpoint name
-   `path` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)?** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## bootstrap#Server

**Extends EventEmitter**

Server constructor.

Events

-   `bootstrapRequest`: device bootstrap request.

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)?** 
    -   `options.type` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** IPv4 (udp4) or IPv6 (udp6) connections (optional, default `'upd6'`)
    -   `options.piggybackReplyMs` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** milliseconds to wait for a piggyback response (optional, default `50`)

**Examples**

```javascript
var bootstrap = require('lwm2m').bootstrap;
var server = bootstrap.createServer();

server.on('error', function(err) {
  throw err;
});

server.on('close', function() {
  console.log('server is done');
});

server.on('bootstrapRequest', function(params, accept) {
  console.log('endpoint %s contains %s', params.ep, params.payload);
  accept();
});

// the default CoAP port is 5683
server.listen();
```

### write

Makes a Write operation over the designed resource ID of the selected device.

**Parameters**

-   `endpoint` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** client endpoint name
-   `path` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `value` **([Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object) \| [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) \| [Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) \| [Buffer](https://nodejs.org/api/buffer.html))** 
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)?** 
    -   `options.format` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** media type.
    -   `options.schema` **[Schema](#schema)** schema to serialize value when an object.
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)?** 

**Examples**

```javascript
var schema = Schema({
  foo : { 
    id: 5, 
    type: 'String' 
  },
  bar : { 
    id: 6, 
    type: 'Number' 
  },
});

var options = { 
  schema: schema, 
  format: 'json',
};

var value = {
  foo: 'test',
  bar: 42,
};

var promise = server.write('test', '/42/3', value, options)
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

### delete

Deletes the LWM2M Object instance in `path` of endpoint `endpoint`

**Parameters**

-   `endpoint` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** client endpoint name
-   `path` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)?** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

### finish

Terminate the Bootstrap Sequence previously initiated

**Parameters**

-   `endpoint` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** client endpoint name
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)?** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## Registry

**Extends EventEmitter**

Registry for clients. 
Default implementation is in-memory.

For production use, extend `Registry` class and 
give new implementations to
\_get, \_find, \_save, \_update and \_delete.

### \_find

get client by endpoint name

**Parameters**

-   `endpoint` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** callback is given
    the two arguments `(err, client)`

### \_get

get client by location in the registry

**Parameters**

-   `location` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** callback is given
    the two arguments `(err, client)`

### \_save

store a new client in the registry

**Parameters**

-   `client` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** callback is given
    the two arguments `(err, location)`

### \_update

update a client in the registry

**Parameters**

-   `location` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `params` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** callback is given
    the two arguments `(err, location)`

### \_delete

delete client from the registry

**Parameters**

-   `location` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `callback` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** callback is given
    the two arguments `(err, client)`
