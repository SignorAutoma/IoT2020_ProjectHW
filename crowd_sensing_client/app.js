const http = require('http');
const express = require('express');
const crowdSensing = __dirname + '/views/crowd_sensing.ejs';

const app = express();
var io = require('socket.io');
var server = http.createServer(app);
var listener = io.listen(server);
let fs = require('fs');
const mongoose = require('mongoose');
const Data = require('./models/data.model');

const { PubSub } = require('@google-cloud/pubsub');
const projectId = "signorautoma-iot";
const timeout = 180;
const pubSubClient = new PubSub(projectId);
const subscriptionName = 'projects/signorautoma-iot/subscriptions/first-assignment';

const header = {
  title: "Google Cloud-based IoT system dashboard",
  info: "Retriving data from a set of virtual environmental sensors",
  author: "By Fabio Caputo, 1695402"
}


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
    lastHour.setHours(lastHour.getHours()-1);
    
  }
});


app.use(express.static(__dirname + '\\IoT_ProjectHW\\views'));
app.set('view engine', 'ejs');

app.get('/', function (req, res) {
  res.render(crowdSensing, { header });
});


listener.on('connection', function (socket) {

  console.log('Connection to client established - Crowd');

  socket.on('disconnect', function () {
    console.log('Server has disconnected');
  });

});

server.listen(process.env.PORT || 8888);

