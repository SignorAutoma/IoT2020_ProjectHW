const http = require('http');
const express = require('express');
const fs = require('fs');
const ejs = require('ejs');
const template = fs.readFileSync(__dirname + '/templates/index.ejs').toString();
const app = express();
const { PubSub } = require('@google-cloud/pubsub');


const pubSubClient = new PubSub();
const subscriptionName = 'projects/iot2020-project/subscriptions/my-subscription';

const header = {
  title: "Simple IoT MQTT-Google Cloud Server",
  info: "Retriving data from devices",
}

function listenForMessages() {
  // References an existing subscription
  try {
    const subscription = pubSubClient.subscription(subscriptionName);

    const messageHandler = message => {
      console.log(`Received message ${message.id}:`);
      console.log(`\tData: ${message.data}`);
      console.log(`\tAttributes: ${message.attributes}`);
      message.ack();
    };

    // Listen for new messages until timeout is hit
    subscription.on('message', messageHandler);
  } catch (error) {
    console.error(error);
  }

}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });

  const output = ejs.render(template, { header });

  res.end(output);
});

const callback = () => {
  const address = server.address().address;
  const port = server.address().port;
  listenForMessages();

  console.log('Server Listening on http://' + address + ':' + port);
}

server.listen(8000, '127.0.0.1', callback)


app.use(express.static(__dirname));
