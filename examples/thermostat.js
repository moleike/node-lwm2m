/* eslint-disable no-console */
var Schema = require('../lib/schema');
var senml = require('../lib/senml');

// IPSO temperature sensor (3303)
var temperature = Schema({
  value: { type: 'Float', id: 5700, required: true },
  units: { type: 'String', id: 5701 },
});
                                
// IPSO actuation (3306)
var actuation = Schema({
  onOff:  { type: 'Boolean', id : 5850, required: true },
  dimmer: { type: 'Integer', id: 5851, range: { min: 0, max: 100 } },
});

// IPSO setpoint (3308)
var setPoint = Schema({
  value: { type: 'Float', id: 5900, required: true },
  units: { type: 'String', id: 5701 },
});

// composite schema
var thermostat = Schema({
  input: { 
    type: 'Objlnk',
    id: 7100,
    schema: temperature,
  },
  setpoint: { 
    type: 'Objlnk',
    id: 7101, 
    schema: setPoint, 
  },
  output: {
    type: 'Objlnk',
    id: 7102,
    schema: actuation,
  },
});

var sample = '{"bn":"/","e":[' +
  '{"n":"8300/0/7100","ov":"3303:0"},' +
  '{"n":"8300/0/7101","ov":"3308:0"},' +
  '{"n":"8300/0/7102","ov":"3306:0"},' +
  '{"n":"3303/0/5700","v":26.5},' +
  '{"n":"3303/0/5701","sv":"Cel"},' +
  '{"n":"3306/0/5850","bv":true},' +
  '{"n":"3306/0/5851","v":50},' +
  '{"n":"3308/0/5900","v":24},' +
  '{"n":"3308/0/5701","sv":"Cel"}]}';

var result = senml.parse(sample, thermostat); 
console.log(result);
//{ input: { value: 26.5, units: 'Cel' },
//  setpoint: { value: 24, units: 'Cel' },
//  output: { onOff: true, dimmer: 50 } }

