const http = require('http');
const express = require('express');
const fs = require('fs');
const ejs = require('ejs');
const template = __dirname + '/views/index.ejs';
const app = express();
const bodyParser = require('body-parser');
var io = require('socket.io');
var server = http.createServer(app);
var listener = io.listen(server);
const mongoose = require('mongoose');
const Data = require('./models/data.model');

const { PubSub } = require('@google-cloud/pubsub');
const projectId = "signorautoma-iot";
const timeout = 180;
const pubSubClient = new PubSub(projectId);
const subscriptionName = 'projects/signorautoma-iot/subscriptions/first-assignment';

const header = {
  title: "Simple IoT MQTT-Google Cloud Server",
  info: "Retriving data from devices",
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
]

// CONNESSIONE AL DATABASE
mongoose.Promise = global.Promise;

const uri = "mongodb+srv://SignorAutoma:provaiot2020@cluster0-auf7a.gcp.mongodb.net/test?retryWrites=true&w=majority";

mongoose.connect(uri, { useNewUrlParser: true }, function (err, res) {
  if (err) {
    console.error('ERROR:\n\nDATABASE NON RAGGIUNGIBILE\n' + JSON.stringify(err));
    console.error(err);
  } else {
    console.log('DEBUG: CONNESSO AL DATABASE ');
    
    Data.find({date: { $gt: parseInt(Date.now()/1000) - 3600 }})
      .then(values => {
        for (i = 0; i < values.length; i++) {
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
          else {
            log[4].lastValue = values[i]._doc.value;
            log[4].values.push(values[i]._doc.value);
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
      var x = data[0].toString();
      var y = data[1].toString();

      const received = {
        device: x,
        value: y,
        date: Date.now()/1000,
      };
      new Data(received).save();

      if (x == "thermometer") {
        log[0].lastValue = y;
        log[0].values.push(y);
        socket.emit('t_lastValue', log[0].lastValue);
        socket.emit('t_values', log[0].values);
      }
      else if (x == "humidity") {
        log[1].lastValue = y;
        log[1].values.push(y);
        socket.emit('h_lastValue', log[1].lastValue);
        socket.emit('h_values', log[1].values);
      }
      else if (x == "wind-direction") {
        log[2].lastValue = y;
        log[2].values.push(y);
        socket.emit('wd_lastValue', log[2].lastValue);
        socket.emit('wd_values', log[2].values);
      }
      else if (x == "wind-intensity") {
        log[3].lastValue = y;
        log[3].values.push(y);
        socket.emit('wi_lastValue', log[3].lastValue);
        socket.emit('wi_values', log[3].values);
      }
      else {
        log[4].lastValue = y;
        log[4].values.push(y);
        socket.emit('rh_lastValue', log[4].lastValue);
        socket.emit('rh_values', log[4].values);
      }

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

async function listenForErrors() {
  // References an existing subscription
  const subscription = pubSubClient.subscription(subscriptionName);

  // Create an event handler to handle messages
  const messageHandler = function (message) {
    // Do something with the message
    console.log(`Message: ${message}`);

    // "Ack" (acknowledge receipt of) the message
    message.ack();
  };

  // Create an event handler to handle errors
  const errorHandler = function (error) {
    // Do something with the error
    console.error(`ERROR: ${error}`);
  };

  // Listen for new messages/errors until timeout is hit
  subscription.on('message', messageHandler);
  subscription.on('error', errorHandler);

  setTimeout(() => {
    subscription.removeListener('message', messageHandler);
    //subscription.removeListener('error', errorHandler);
  }, timeout * 1000);
}


app.use(express.static(__dirname + '\\IoT_ProjectHW\\views'));
app.set('view engine', 'ejs');

app.get('/', function (req, res) {
  res.render(template, { header, log });
});


listener.on('connection', function (socket) {

  console.log('Connection to client established');
  listenForMessages(socket)

  socket.on('disconnect', function () {
    console.log('Server has disconnected');
  });

});

server.listen(process.env.PORT || 8080);

