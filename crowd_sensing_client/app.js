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


//#region Config ACCELEROMETER

const projectId = `signorautoma-iot`;
const deviceId = `accelerometer`;
const registryId = `generic-test`;
const region = `us-central1`;
const algorithm = 'RS256';
const privateKeyFile = `./rsa_private.pem`;
const mqttBridgeHostname = `mqtt.googleapis.com`;
const mqttBridgePort = 8883;
const messageType = `events`;
const numMessages = 5;
const deviceIdCloud = `accelerometer_cloud`;

//#endregion


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

// To authenticate to Cloud IoT Core, each device must prepare a JSON Web Token (JWT, RFC 7519).
// JWTs are used for short-lived authentication between devices and the MQTT or HTTP bridges
const createJwt = (projectId, privateKeyFile, algorithm) => {
  // Create a JWT to authenticate this device. The device will be disconnected
  // after the token expires, and will have to reconnect with a new token. The
  // audience field should always be set to the GCP project id.
  const token = {
    iat: parseInt(Date.now() / 1000),
    exp: parseInt(Date.now() / 1000) + 20 * 60, // 20 minutes
    aud: projectId,
  };
  const privateKey = fs.readFileSync(privateKeyFile);
  return jwt.sign(token, privateKey, { algorithm: algorithm });
};


// The mqttClientId is a unique string that identifies this device.
const mqttClientId = `projects/${projectId}/locations/${region}/registries/${registryId}/devices/${deviceId}`;
const mqttClientIdCloud = `projects/${projectId}/locations/${region}/registries/${registryId}/devices/${deviceIdCloud}`;

const connectionArgs = {
  host: mqttBridgeHostname,
  port: mqttBridgePort,
  clientId: mqttClientId,
  username: 'unused',
  password: createJwt(projectId, privateKeyFile, algorithm),
  protocol: 'mqtts',
  secureProtocol: 'TLSv1_2_method',
};

const connectionArgsCloud = {
  host: mqttBridgeHostname,
  port: mqttBridgePort,
  clientId: mqttClientIdCloud,
  username: 'unused',
  password: createJwt(projectId, privateKeyFile, algorithm),
  protocol: 'mqtts',
  secureProtocol: 'TLSv1_2_method',
};


// Create a client, and connect to the Google MQTT bridge.

const client = mqtt.connect(connectionArgs);
const clientCloud = mqtt.connect(connectionArgsCloud);

// Subscribe to the /devices/{device-id}/config topic to receive config updates. we are going to use QOS1
client.subscribe(`/devices/${deviceId}/config`, { qos: 1 });
clientCloud.subscribe(`/devices/${deviceIdCloud}/config`, { qos: 1 });

// Subscribe to the /devices/{device-id}/commands/# topic to receive all
client.subscribe(`/devices/${deviceId}/commands/#`, { qos: 0 });
clientCloud.subscribe(`/devices/${deviceIdCloud}/commands/#`, { qos: 0 });

// The MQTT topic that this device will publish data to.
const mqttTopic = `/devices/${deviceId}/${messageType}`;
const mqttTopicCloud = `/devices/${deviceIdCloud}/${messageType}`;

client.on('connect', success => {
  try {
    console.log('connect');
    if (!success) {
      console.log('Client not connected...');
    } else {
      console.log('Client connected - Edge...');
    }
  } catch (error) {
    console.error(error);
  }
});


client.on('close', () => {
  console.log('close');
  shouldBackoff = true;
});

client.on('error', err => {

  console.log('error', err);

});

client.on('message', (topic, message) => {
  let messageStr = 'Message received: ';
  if (topic === `/devices/${deviceId}/config`) {
    messageStr = 'Config message received: ';
  } else if (topic.startsWith(`/devices/${deviceId}/commands`)) {
    messageStr = 'Command message received: ';
  }

  messageStr += Buffer.from(message, 'base64').toString('ascii');
  console.log(messageStr);
});

clientCloud.on('packetsend', () => {
  // Note: logging packet send is very verbose
});


clientCloud.on('connect', success => {
  try {
    console.log('connect to client for cloud computing');
    if (!success) {
      console.log('Client not connected...');
    } else {
      console.log('Client connected - Cloud...');
    }
  } catch (error) {
    console.error(error);
  }
});


clientCloud.on('close', () => {
  console.log('close');
  shouldBackoff = true;
});

clientCloud.on('error', err => {

  console.log('error', err);

});

const publishAsync = (
  mqttTopic,
  client,
  data,
) => {
  // Function that push the sensor value on Google Cloud
  var status = JSON.stringify(data.status);
  var x = JSON.stringify(data.x);
  var y = JSON.stringify(data.y);
  var z = JSON.stringify(data.z);
  console.log("x: " + x + " y: " + y + " z:" + z + " ======> " + status);
  const payload = deviceId + ":" + status + ":" + "crowd_sensing";
  // Publish "payload" to the MQTT topic. qos=1 means at least once delivery. (There is also qos=0)
  console.log('Publishing message:', payload);
  client.publish(mqttTopic, payload, { qos: 1 });
};

const publishCloud = (
  mqttTopic,
  client,
  data,
) => {
  // Function that push the sensor value on Google Cloud
  var x = JSON.stringify(data.x);
  var y = JSON.stringify(data.y);
  var z = JSON.stringify(data.z);
  console.log("x: " + x + " y: " + y + " z:" + z);


  const payload = deviceId + ":" + JSON.stringify(data) + ":" + "crowd_sensing";
  // Publish "payload" to the MQTT topic. qos=1 means at least once delivery. (There is also qos=0)
  console.log('Publishing message:', payload);
  client.publish(mqttTopic, payload, { qos: 1 });
};

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

  socket.on('data', function (data) {
    //publishAsync(mqttTopic, client, data)           //Edge
    publishCloud(mqttTopicCloud, clientCloud, data) //Cloud
  });

  socket.on('disconnect', function () {
    console.log('Server has disconnected');
  });

});

server.listen(process.env.PORT || 8888);

