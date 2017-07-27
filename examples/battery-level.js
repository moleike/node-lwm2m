/* eslint-disable no-console */

// wakaama example client changing battery level over time:
// $ ./lwm2mclient -4 -c
var server = require('..').createServer();

server.on('register', function(params, accept) {
  setImmediate(function() {
    var ep = params.ep;
    var attr = { 
      pmin: 1, 
      pmax: 3,
    };

    server
      .writeAttributes(ep, '/3/0/9', attr)
      .then(function() {
        return server.observe(ep, '/3/0/9');
      })
      .then(function(stream) {
        stream
          .on('data', function(value) {
            console.log('battery level: %d%', value);
          });
      })
      .catch(function(err) {
        console.log(err);
      });
  });
  accept();
});

server.listen(5683);
