'use strict';

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const io = require('socket.io')();

const indexRouter = require('./routes/index');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

const namespaces = io.of(/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
// create array of empty users
const users = {};

namespaces.on('connection', function(socket) {
  // 'namespace' is only for diagnostic purposes
  // 'socket' object used only for listening and emitting
  const namespace = socket.nsp;
  socket.emit('message', `Successfully connected on namespace: ${namespace.name}`);
  // listen for call and broadcast to receiving client
  socket.on('calling', function(){
    socket.broadcast.emit('calling');
  });
  // handle signaling events and their 'destructured' object data
  socket.on('signal', function({ description, candidate }) {
    console.log(`Signal received from ${socket.id}`);
    console.log({ description, candidate });
    // broadcast received signal so sender does not get its' own description/candidate
    socket.broadtcast.emit('signal', { description, candidate });
  });
});

// create a connection socket for connected user
io.on('connection', function(socket) {
  // broadcasting user connection to client
  socket.on('new-user', function(userName) {
    users[socket.id] = userName;
    socket.broadcast.emit('user-connected', userName);
  })
  // broadcast message to client
  socket.on('send-chat-message', function(message) {
    socket.broadcast.emit('chat-message', {message: message, name: users[socket.id] });
  });
  // broadcasting user disconnection from client
  // deletes specific socket.id from users array
  socket.on('disconnect', function() {
    socket.broadcast.emit('user-disconnected', users[socket.id]);
    delete users[socket.id];
  })
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = {app, io};
