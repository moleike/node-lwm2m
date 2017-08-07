/* eslint-disable no-console */

var lwm2m = require('..')
  , MongoRegistry = require('./mongodb-registry');

// Connection URL
var url = 'mongodb://localhost:27017/lwm2m2';

var server = lwm2m.createServer({
  registry: new MongoRegistry(url),
});

server.on('register', function(params, accept) {
  setImmediate(function() {
    server._registry
      .find(params.ep)
      .then(console.log);
  });

  accept();
});

server.listen(5683);



        

      
