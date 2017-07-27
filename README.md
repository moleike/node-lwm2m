# node-lwm2m

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![build status][appveyor-image]][appveyor-url]
[![codecov][codecov-image]][codecov-url]

[npm-image]: https://img.shields.io/npm/v/lwm2m.svg?style=flat-square
[npm-url]: https://npmjs.org/package/lwm2m
[travis-image]: https://img.shields.io/travis/moleike/node-lwm2m/develop.svg?style=flat-square
[travis-url]: https://travis-ci.org/moleike/node-lwm2m
[appveyor-image]: https://img.shields.io/appveyor/ci/moleike/node-lwm2m/develop.svg?style=flat-square
[appveyor-url]: https://ci.appveyor.com/project/moleike/node-lwm2m
[codecov-image]: https://img.shields.io/codecov/c/github/moleike/node-lwm2m.svg?style=flat-square
[codecov-url]: https://codecov.io/gh/moleike/node-lwm2m

WIP

[node-lwm2m][self] is an implementation of the Open Mobile Alliance's Lightweight M2M protocol (LWM2M).

This is a fork of @telefonicaid's [lwm2m-node-lib](https://github.com/telefonicaid/lwm2m-node-lib), but adds missing features in the original project required for a compliant implementation. Considerable work has been done so that it is now a distinct project.

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

## Server
  - [`createServer()`](#createserveroptionsobject)
  - [`listen()`](#listenportnumber)
  - [`read()`](#readepstring-pathstring-optionsobject-callbackfunction)
  - [`write()`](#writeepstring-pathstring-valueobjectstringnumberbuffer-optionsobject-callbackfunction)
  - [`execute()`](#executeepstring-pathstring-valuestring-callbackfunction)
  - [`writeAttributes()`](#writeattributesepstring-pathstring-attributesobject-callbackfunction)
  - [`discover()`](#discoverepstring-pathstring-callbackfunction)
  - [`create()`](#createepstring-pathstring-valueobjectstringnumberbuffer-optionsobject-callbackfunction)
  - [`remove()`](#removeepstring-pathstring-callbackfunction)
  - [`observe()`](#observeepstring-pathstring-callbackfunction)
  - [`cancel()`](#cancelepstring-pathstring-callbackfunction)

## Schemas

  - [`Schema()`](#schemadefinitionsobject)
  - [`Schema.validate()`](#schemavalidateobjobject)
  
## createServer(options:Object)

  Server constructor.

  Options:
  

  - `type`: indicates if the server should create IPv4 connections (udp4) or IPv6 connections (udp6). Defaults to udp6.
  - `deviceRegistry`: defaults to an in-memory registry.
  - `piggybackReplyMs`: set the number of milliseconds to wait for a piggyback response. Default 50.
  
  Events:
  
  - `register`: device registration request.
  - `update`: device registration update.
  - `unregister`: device unregistration.
  

  
## listen(port:Number)

  Start listening for connections, default port is 5683. This function
  is inherited from [node-coap](https://github.com/mcollina/node-coap).


## read(ep:String, path:String, [options]:Object, callback:Function)

  Read `path` on device with endpoint name `ep`. The callback is given
  the two arguments `(err, res)`, where `res` is parsed using `schema`.
  A path represents either an LWM2M Object instance or resource.
  
  Options:
  
  - `schema` defining resources.
  
  Example:
  
```js
var schema = Schema({
  test: { id: 1, type: Number }
});
```

  
```js
server.read('dev0', '/1024/11', { schema }, function(err, res) {
  assert(res.hasOwnProperty('test'));
  assert(typeof res.test == 'number');
});
```

  
  Schemas can be preloaded on the constructor e.g.
  
```js
var server = lwm2m.createServer({ schemas: {
  '/3': Schema(require('lwm2m/oma/device.json'))
}});
```

  
```js
server.read('dev0', '/3/0', function(err, device) {
  assert(device.hasOwnProperty('manufacturer'));
});
```

  
```js
server.read('dev0', '/3/0/5', function(err, pwrSrcs) {
  assert(Array.isArray(pwrSrcs));
});
```

  
  Note:
  
  _If no schema is provided will return a `Buffer` if the payload is `TLV`-encoded
  or opaque, or an `String` otherwise._

## write(ep:String, path:String, value:Object|String|Number|Buffer, [options]:Object, callback:Function)

  Makes a Write operation over the designed resource ID of the selected device.

## execute(ep:String, path:String, value:String, callback:Function)

  Makes an Execute operation over the designed resource ID of the selected device.

## writeAttributes(ep:String, path:String, attributes:Object, callback:Function)

  Write `attributes` into `path` of endpoint `ep`.
  
  Example:
  
```js
var attr = {
  "pmin": 5,
  "pmax": 10
};
```

  
```js
server.writeAttributes('dev0', '3303/0/5700', attr, function(err, res) {
   assert.ifError(err);
});
```

## discover(ep:String, path:String, callback:Function)

  Execute a discover operation for the selected resource.

## create(ep:String, path:String, value:Object|String|Number|Buffer, [options]:Object, callback:Function)

  Create a new LWM2M Object for `path`, where path is an Object ID.

## remove(ep:String, path:String, callback:Function)

  Deletes the LWM2M Object instance in `path` of endpoint `ep`

## observe(ep:String, path:String, callback:Function)

 Observe changes in `path` of device with endpoint name `ep`. 
 The notification behaviour, e.g. periodic or event-triggered reporting, is configured with the 
 `writeAttributes` method. The callback is given the two arguments `(err, stream)`, 
 where `stream` is a `Readable Stream`. To stop receiving notifications `close()` the stream
 and (optionally) call `cancel()` on the same `ep` and `path` and .
  
  Example:
    
```js
server.observe('dev0', '/1024/10/1', function(err, stream) {
  stream.on('data', function(value) {
    console.log('new value %s', value);
  });
  
  stream.on('end', function() {
    console.log('stopped observing');
  });
});
```

## cancel(ep:String, path:String, callback:Function)

  Cancel an observation for `path` of device `ep`.
  
  
---

## Schema(definitions:Object)

  Schema constructor.
  
  An `Schema` describes the shape of an [`Smart Object`](https://www.ipso-alliance.org/). 
  An Object is a collection of resources with the following properties:
  
  - `id`: the Resource ID
  - `type`: String | Number | Boolean | Buffer; [type] for multiple instances
  - `enum`: values are enumerated (Optional)
  - `range`: values are within a range (Optional)
  - `required`: the resource is mandatory. Defaults to `false`
  
  **Examples**
  
  A temperature sensor:
  
```js
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
```

  
  A light controller:
  
```js
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
```

  
  LWM2M Server Object:
  
```js
var schema = new Schema({
  serverId: {
    id: 0,
    type: Number,
    range: { min: 1, max: 65535 }
  },
  lifetime: {
    id: 1,
    type: Number
  },
  notifyStoring: {
    id: 6,
    type: Boolean
  },
  binding: {
    id: 7,
    type: String,
    enum: ['U','UQ','S','SQ','US','UQS']
  }
});
```

  
  See [oma](oma) directory for examples of definitions.

## Schema.validate(obj:Object)

  validates `obj` with `schema`.
