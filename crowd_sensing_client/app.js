const http = require('http');
const express = require('express');
const crowdSensing = __dirname + '/views/crowd_sensing.ejs';

const app = express();
var io = require('socket.io');
var server = http.createServer(app);
var listener = io.listen(server);
let fs = require('fs');
const jwt = require('jsonwebtoken');
const mqtt = require('mqtt');

console.log('Smartphone Connection');

const mongoose = require('mongoose');



// CONNESSIONE AL DATABASE
mongoose.Promise = global.Promise;

const uri = process.env.MONGODB_URI || "mongodb+srv://SignorAutoma:provaiot2020@cluster0-auf7a.gcp.mongodb.net/test?retryWrites=true&w=majority";

mongoose.connect(uri, { useNewUrlParser: true }, function (err, res) {
  if (err) {
    console.error('ERROR:\n\nDATABASE NON RAGGIUNGIBILE\n' + JSON.stringify(err));
    console.error(err);
  } else {
    console.log('DEBUG: CONNESSO AL DATABASE - Crowd');

    var lastHour = new Date();
    lastHour.setHours(lastHour.getHours() - 1);

  }
});

publishAsync = (socket) => {
  while(1) {
    socket.on('data', function (data) {
      console.log("new data");
    });
  }
}

app.use(express.static(__dirname + '\\IoT_ProjectHW\\views'));
app.set('view engine', 'ejs');

app.get('/', function (req, res) {
  res.render(crowdSensing);
});

app.get('/crowdSensing', function (req, res) {
  res.render(crowdSensing);
});

listener.on('connection', function (socket) {

  console.log('Connection to client established - Crowd');


  publishAsync(socket)
  

  socket.on('disconnect', function () {
    console.log('Server has disconnected');
  });

});

server.listen(process.env.PORT || 8888);

