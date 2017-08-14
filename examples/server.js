/* eslint-disable no-console */

var MongoRegistry = require('./mongodb-registry');

// Connection URL
var url = 'mongodb://localhost:27017/lwm2m2';

var server = require('..').createServer({
  registry: new MongoRegistry(url),
});

server.on('error', function(err) {
  console.log(err.message);

  process.exit(1);
});

server.on('register', function(params, accept) {
  console.log('client registration');

  accept();
});

server.on('update', function(location) {
  console.log('client update');

  server._registry.get(location)
    .then(console.log, console.log);
});

server.on('deregister', function(client) {
  console.log('client deregistered');

  console.log(client);
});

server.listen(5683);
