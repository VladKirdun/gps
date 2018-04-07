
const express = require('express');
const app = express();
const router = express.Router();
const port = 3000;
const url = require('url');

var sha256 = require('js-sha256');
var crypto = require('crypto');
var aesCross = require('./aes.js');

var MongoClient = require('mongodb').MongoClient;
var format = require('util').format;
var keys = require('./keys.json');

var urlDB = "mongodb://localhost:27017";

// MongoClient.connect(urlDB, function(err, database) {
// 	if(err) throw err;

// 	console.log('Connection established!');
// 	const myDB = database.db('gps');
// 	const myDBCollection = myDB.collection('pares');

// 	//удаление коллекции из бд
// 	myDBCollection.drop();

// 	//вставка нескольких строк(пар) в коллекцию
// 	myDBCollection.insertMany(keys, function(err, result){
// 		if(err) {
// 			console.log(err);
// 			return;
// 		}
// 		console.log(result.ops);		
// 	});
// 	database.close();
// });

// function getTime(){
// 	var hours = new Date().getHours();
// 	var minutes = new Date().getMinutes();
// 	if (hours < 10) {
// 		hours = '0' + hours;
// 	}
// 	if(minutes < 10) {
// 		minutes = '0' + minutes;
// 	}
// 	var time = hours + ':' + minutes;
// 	return time
// }

// ________________________ 1 ______________________________

var coordLat = 53.88928457643;
var coordLng = 27.56474572543;
var time = new Date();
var jsonStr = 'time:' + time + ',lat:' + coordLat + ',lng:' + coordLng;
console.log(jsonStr);

// ________________________ 2 ______________________________

var hash = sha256(jsonStr);
console.log(hash);

jsonStr += ',hash:' + hash;
console.log(jsonStr);

// ________________________ 3 ______________________________

// AES/cbc/pkcs5Padding
var cipherMode = aesCross.setCipherMode('cbc');
var keySize = aesCross.setKeySize(256);
var text = jsonStr;
var key = 'ytrewqmnbvcxzlkjhgfdsapoiuytrewq';
var iv = new Buffer([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
var outputEncoding = 'base64';
var inputEncoding = 'utf8';

var enc = aesCross.encText(text, key, iv, inputEncoding, outputEncoding);
console.log(enc);
console.log('');

app.get('/', (request, response) => response.send('Hello World'));

app.use('/api', router);

router.get('/stuff', (request, response) => {
  var urlParts = url.parse(request.url, true);
  var parameters = urlParts.query;
  
  var identificator = parameters.id;
  var encdata = parameters.encdata;

  encdata = encdata.replace(/ /g, '+');
	parameters.encdata = encdata;
	console.log("\nEncrypted data:\n" + encdata);

	MongoClient.connect(urlDB, function(err, database) {
		if(err) throw err;

		console.log('Connection established!');
		const myDB = database.db('gps');
		const myDBCollection = myDB.collection('pares');

		console.log("\nid: " + identificator);
		//нахождение значения по ключу 
		myDBCollection.findOne({id: identificator}, function(err, result){
			if(err) {
				console.log(err);
				console.log("ERROR!!!");
				return;
			}
			console.log("key: " + result.key);	
			var key = result.key;	
		
			var dec = aesCross.decText(encdata, key, iv, inputEncoding, outputEncoding);
			console.log("\nDecrypted data:\n" + dec);

			var obj = {};
			var arr = dec.split(',');
			for(var i = 0; i < arr.length; i++) {
				if(arr[i].includes('time')) {
					obj.time = arr[i].split(':').slice(1).join(':');
				} else if (arr[i].includes('lat')) {
					obj.lat = arr[i].split(':')[1];
				} else if (arr[i].includes('lng')) {
					obj.lng = arr[i].split(':')[1];
				} else if (arr[i].includes('hash')) {
					obj.hash = arr[i].split(':')[1];
				}
			}
			arr.pop();

			console.log(" ");
			console.log("My hash:     " + sha256(arr.join(',')));
			console.log("Client hash: " + obj.hash);

			console.log("\nComparison of hashes: ");
			if(sha256(arr.join(',')) === obj.hash) {
				console.log('true');
			}
			else {
				console.log('false');
			}
			parameters.dec = dec;

			response.send('<style>*{margin:0;padding:0;}</style><script async defer src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDt21eywaiop_mdVwbORxI2G5Vj56Ev3l0&callback=initMap"></script><p id="result">Где вы живете?</p><div id="map" style="width: 100%; height: 650px;"></div><script>function initMap() {var result = document.getElementById("result");	var myLatLng = {lat: -25.363, lng: 131.044}; var map = new google.maps.Map(document.getElementById("map"), { center: myLatLng, zoom: 17 }); var infoWindow = new google.maps.InfoWindow({map: map}); if (navigator.geolocation) { navigator.geolocation.getCurrentPosition(function(position) { var pos = { lat: ' + obj.lat + ', lng: ' + obj.lng + ' }; result.textContent = pos.lat + " x " + pos.lng; var marker = new google.maps.Marker({ position: pos || myLatLng, map: map, title: "Hello World!"});map.setCenter(pos);}, function() { handleLocationError(true, infoWindow, map.getCenter()); }); } else { handleLocationError(false, infoWindow, map.getCenter()); } } function handleLocationError(browserHasGeolocation, infoWindow, pos) { infoWindow.setPosition(pos); infoWindow.setContent(browserHasGeolocation ? "Error: The Geolocation service failed." : "Error: Your browser doesn\'t support geolocation."); }</script>');

			console.log("____________________________________________________________________________");

		});
		database.close();
	});

});

app.listen(port, () => console.log(`Listening on port ${port}`));

