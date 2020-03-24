const fs = require('fs');
const jwt = require('jsonwebtoken');
const mqtt = require('mqtt');

console.log('HUMIDITY');


//#region Config HUMIDITY

const projectId = `signorautoma-iot`;
const deviceId = `humidity`;
const registryId = `first-assignment`;
const region = `europe-west1`;
const algorithm = 'RS256';
const privateKeyFile = `./rsa_private.pem`;
const mqttBridgeHostname = `mqtt.googleapis.com`;
const mqttBridgePort = 8883;
const messageType = `events`;
const numMessages = 5;
//#endregion

//#region Function

//send PUBLISH messages through the MQTT connection
const publishAsync = (
    mqttTopic,
    client,
) => {
    setTimeout(() => {
        // Function to create random values to send to the cloud platform

        var perc = Math.floor(Math.random() * (50)) + '%';
        const payload = deviceId + ": " + perc;
        // Publish "payload" to the MQTT topic. qos=1 means at least once delivery. (There is also qos=0)
        console.log('Publishing message:', payload);
        client.publish(mqttTopic, payload, { qos: 1 });

        // Recursive function to simulate the periodically sent of values
        publishAsync(mqttTopic, client);
    }, 5000);
};

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
//#endregion 


// The mqttClientId is a unique string that identifies this device.
const mqttClientId = `projects/${projectId}/locations/${region}/registries/${registryId}/devices/${deviceId}`;

const connectionArgs = {
    host: mqttBridgeHostname,
    port: mqttBridgePort,
    clientId: mqttClientId,
    username: 'unused',
    password: createJwt(projectId, privateKeyFile, algorithm),
    protocol: 'mqtts',
    secureProtocol: 'TLSv1_2_method',
};


// Create a client, and connect to the Google MQTT bridge.
const iatTime = parseInt(Date.now() / 1000);
const client = mqtt.connect(connectionArgs);

// Subscribe to the /devices/{device-id}/config topic to receive config updates. we are going to use QOS1
client.subscribe(`/devices/${deviceId}/config`, { qos: 1 });

// Subscribe to the /devices/{device-id}/commands/# topic to receive all
client.subscribe(`/devices/${deviceId}/commands/#`, { qos: 0 });

// The MQTT topic that this device will publish data to.
const mqttTopic = `/devices/${deviceId}/${messageType}`;

client.on('connect', success => {
    try {
        console.log('connect');
        if (!success) {
            console.log('Client not connected...');
        } else {
            publishAsync(mqttTopic, client);
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

client.on('packetsend', () => {
    // Note: logging packet send is very verbose
});

  // Once all of the messages have been published, the connection to Google Cloud
  // IoT will be closed and the process will exit. See the publishAsync method.
