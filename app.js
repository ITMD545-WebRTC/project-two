'use strict';

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const io = require('socket.io')();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const { user } = require('./models/usermodel');
const app = express();
const util = require('./lib/utilities');

mongoose.connect('mongodb+srv://jtran:mongodb@fpdb-cluster0-095uj.mongodb.net/test?retryWrites=true&w=majority',
  {
    useUnifiedTopology: true,
    useNewUrlParser: true
  }
)
.then(() => console.log('Connected to MongoDB'))
.catch(error => console.error('Error: ', error));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
    return res.status(200).json({});
  };
  next();
});

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/auth', authRouter);
app.get('/', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  var username = req.body.username;
  var password = req.body.password;
  user.findOne({
    username: username,
    password: password},
    (error, user) => {
      if (error) {
        console.log(error);
        return res.status(500).json({
          message: error.message
        });
      } else if (!user) {
        return res.status(401).json({
          message: 'Incorrect username or password'
        });
      }
      return res.redirect(`/${util.randomRoom(3,4,3)}`)
    },
  );
});

const namespaces = io.of(/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/);

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
    socket.broadcast.emit('signal', { description, candidate });
  });
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
