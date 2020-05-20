const http = require('http');
const express = require('express');
const index = __dirname + '/views/index.ejs';
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
const subscriptionName = 'projects/signorautoma-iot/subscriptions/generic-test';
const subscriptionCloudFunction = 'projects/signorautoma-iot/subscriptions/generic-test-cf';

const header = {
  title: "Google Cloud-based IoT system dashboard",
  info: "Retriving data from a set of virtual environmental sensors",
  author: "By Fabio Caputo, 1695402"
}

let log = [
  {
    device: 'thermometer',
    lastValue: '',
    values: [],
  },
  {
    device: 'humidity controller',
    lastValue: '',
    values: [],
  },
  {
    device: 'wind-direction',
    lastValue: '',
    values: [],
  },
  {
    device: 'wind-intensity',
    lastValue: '',
    values: [],
  },
  {
    device: 'rain-height',
    lastValue: '',
    values: [],
  },
  {
    device: 'accelerometer',
    lastValue: '',
    values: [],
  },
  {
    device: 'accelerometer_cloud',
    lastValue: '',
    values: [],
  }
]

// CONNESSIONE AL DATABASE
mongoose.Promise = global.Promise;

const uri = process.env.MONGODB_URI || "mongodb+srv://SignorAutoma:provaiot2020@cluster0-auf7a.gcp.mongodb.net/test?retryWrites=true&w=majority";

mongoose.connect(uri, { useNewUrlParser: true }, function (err, res) {
  if (err) {
    console.error('ERROR:\n\nDATABASE NON RAGGIUNGIBILE\n' + JSON.stringify(err));
    console.error(err);
  } else {
    console.log('DEBUG: CONNESSO AL DATABASE - Dashboard');

    var lastHour = new Date();
    lastHour.setHours(lastHour.getHours() - 1);

    Data.find({ "createdAt": { $gt: lastHour } })
      .then(values => {
        console.log(values);
        for (i = 0; i < values.length; i++) {
          console.log(values[i]._doc.device)
          if (values[i]._doc.device == "thermometer") {
            log[0].lastValue = values[i]._doc.value;
            log[0].values.push(values[i]._doc.value);
          }
          else if (values[i]._doc.device == "humidity") {
            log[1].lastValue = values[i]._doc.value;
            log[1].values.push(values[i]._doc.value);
          }
          else if (values[i]._doc.device == "wind-direction") {
            log[2].lastValue = values[i]._doc.value;
            log[2].values.push(values[i]._doc.value);
          }
          else if (values[i]._doc.device == "wind-intensity") {
            log[3].lastValue = values[i]._doc.value;
            log[3].values.push(values[i]._doc.value);
          }
          else if (values[i]._doc.device == "rain-height"){
            log[4].lastValue = values[i]._doc.value;
            log[4].values.push(values[i]._doc.value);
          }
          else if(values[i]._doc.device == "accelerometer"){ //accelerometer - edge
            log[5].lastValue = values[i]._doc.value == "true"? "Walking" : "Resting";
            log[5].values.push(values[i]._doc.value == "true"? "Walking " : "Resting ");
          }
          else {
            log[6].lastValue = values[i]._doc.value? "Walking" : "Resting";
            log[6].values.push(values[i]._doc.value? "Walking " : "Resting ");
          }
        }
      })
  }
});



function listenForMessages(socket) {
  // References an existing subscription
  const subscription = pubSubClient.subscription(subscriptionName);
  // Create an event handler to handle messages
  let messageCount = 0;
  const messageHandler = message => {
    console.log(`Received message ${message.id}:`);
    console.log(`\tData: ${message.data}`);

    var data = `${message.data}`.split(":");
    if (data != null) {
      var device = data[0].toString();
      var value = data[0] != "accelerometer_cloud"? data[1].toString() : data[1];

      new Data
        ({
          device: device,
          value: value,
          data: Date.now() / 1000
        }).save();

      if (device == "thermometer") {
        log[0].lastValue = value;
        log[0].values.push(value);
        socket.emit('t_lastValue', log[0].lastValue);
        socket.emit('t_values', log[0].values);
      }
      else if (device == "humidity") {
        log[1].lastValue = value;
        log[1].values.push(value);
        socket.emit('h_lastValue', log[1].lastValue);
        socket.emit('h_values', log[1].values);
      }
      else if (device == "wind-direction") {
        log[2].lastValue = value;
        log[2].values.push(value);
        socket.emit('wd_lastValue', log[2].lastValue);
        socket.emit('wd_values', log[2].values);
      }
      else if (device == "wind-intensity") {
        log[3].lastValue = value;
        log[3].values.push(value);
        socket.emit('wi_lastValue', log[3].lastValue);
        socket.emit('wi_values', log[3].values);
      }
      else if (device == "rain-heigh") {
        log[4].lastValue = value;
        log[4].values.push(value);
        socket.emit('rh_lastValue', log[4].lastValue);
        socket.emit('rh_values', log[4].values);
      }
      else if (device == "accelerometer") {
        //Compute at edge, receive and push the value without computing at cloud
        log[5].lastValue = value;
        log[5].values.push(value);
        socket.emit('accelerometer', log[5].lastValue);
        //socket.emit('accelerometer', log[5].values);
      }
      else {
        //Compute at cloud, if delta > 0.7 then user is moving
        var delta = Math.sqrt(value.x * value.x + value.y * value.y + value.z * value.z);
        log[6].lastValue = delta > 0.7
        socket.emit('accelerometer_cloud', log[6].lastValue);
      }
    }
    else {
      console.log("Invalid Data");
    }

    messageCount += 1;
    message.ack();
  };

  // Listen for new messages until timeout is hit
  subscription.on('message', messageHandler);

  setTimeout(() => {
    subscription.removeListener('message', messageHandler);
    console.log(`${messageCount} message(s) received.`);
  }, timeout * 1000);
}


app.use(express.static(__dirname + '\\IoT_ProjectHW\\views'));
app.set('view engine', 'ejs');

app.get('/', function (req, res) {
  res.render(index, { header, log });
});

app.get('/crowdSensing', function (req, res) {
  res.render(crowdSensing, { header, log });
});

listener.on('connection', function (socket) {

  console.log('Connection to client established');

  listenForMessages(socket);

  socket.on('disconnect', function () {
    console.log('Server has disconnected');
  });

});

server.listen(process.env.PORT || 8080);

