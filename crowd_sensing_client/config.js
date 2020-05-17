var exports = module.exports = {};
var self = require('./config.js');

var env =  (process.env.NODE_ENV) ? process.env.NODE_ENV : 'development';

exports.NODE_ENV = env;
exports.projectName = "Crowd Sensing Controll";

exports.PROTOCOL = process.env.PROTOCOL ?  process.env.PROTOCOL : "http";
exports.PORT = process.env.PORT ?  process.env.PORT : 8888;

exports.BASE_URL = () =>{

	if(self.baseUrl) return self.baseUrl;
	else
	{
		let ip = require('ip');
		//let ipAddress = 127.0.0.1;
		let ipAddress = ip.address();
		return self.PROTOCOL + '://' + ipAddress + ':' + self.PORT ;
	}
};


