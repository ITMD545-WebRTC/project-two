'use strict'

const socket = io.connect('/');
var namespace = io.connect('/' + NAMESPACE);

// socket.on('message', function(data) {
//  console.log('Message received: ' + data);
// });

namespace.on('message', function(data) {
  console.log('Message received: ' + data);
});
