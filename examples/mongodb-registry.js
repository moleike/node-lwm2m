var lwm2m = require('..')
  , Registry = lwm2m.Registry
  , MongoClient = require('mongodb').MongoClient;

function MongoRegistry(url) {
  Registry.call(this);

  var _this = this;
  MongoClient.connect(url, function(err, db) {
    if (err) {
      _this.emit('error', err);
      db.close();
    } else {
      _this.clients = db.collection('clients');
    }
  });
}
  

MongoRegistry.prototype = Object.create(Registry.prototype, {
  _save : {
    value: function(client, callback) {
      this.clients.insertOne(client, function(err, result) {
        if (err) {
          callback(err);
        } else {
          callback(null, result._id);
        }
      });
    },
  },
  _find : {
    value: function(endpoint, callback) {
      this.clients.findOne({ ep: endpoint }, callback);
    },
  },
});

MongoRegistry.prototype.constructor = MongoRegistry;

// Connection URL
var url = 'mongodb://localhost:27017/lwm2m';

var server = lwm2m.createServer({
  registry: new MongoRegistry(url),
});

server.on('register', function(params, accept) {
  // TODO
  accept();
});



        

      
