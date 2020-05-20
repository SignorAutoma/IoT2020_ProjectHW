const {PubSub} = require('@google-cloud/pubsub');

// Creates a client; cache this for further use
const pubSubClient = new PubSub("signorautoma-iot");


exports.predict = async(data, context) => {
    const pubSubMessage = data;

    const payload = pubSubMessage.data;

    var splitted = payload.split(":");
    console.log(splitted);

    var device = splitted[0];
    var x = splitted[1];
    var y = splitted[2];
    var z = splitted[3];

    var delta = Math.sqrt(x * x + y * y + z * z);
    console.log(`delta`);

    var moving = delta > 0.7 ? "walking" : "resting";
    console.log(moving);
    var message = device + ":" + moving

    const topicName = "projects/signorautoma-iot/topics/generic-test"
    
    const messageObj = {
        data: {
            message: message
        }
    };
    const messageBuffer = Buffer.from(JSON.stringify(messageObj), 'utf8');
    console.log(messageObj);
    try {
        await pubSubClient.topic(topicName).publisher().publish(messageBuffer);
        console.log("Message sent!")
    } catch (err) {
        console.error(err);
        return Promise.reject(err);
    }

};
//{"data":"acc:0.9:0.8:0.9"}