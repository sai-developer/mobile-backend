var mqtt = require('mqtt');
var config = require('config');

var mqttConfig = config.get('configVariables.mqtt');

var MQTT_TOPIC_NAME = {

    CHOCKS_ON : "/TS/CHOCKS_ON",
    CHOCKS_OFF : "/TS/CHOCKS_OFF",
    TASK_COMPLETE : "/TS/COMPLETE",
    TASK_ASSIGN_COUNT :"/TA/TASK_ASSIGN_COUNT",
    TASK_ASSIGN :"/TA/TASK_ASSIGN",
    ETA_ETD_CHANGE:"/FS/ETA_ETD_CHANGE",
    TASK_UPDATE : "/TS/UPDATE",
    TASK_ASSIGN_V2 : "/TS/TASK_ASSIGN_V2",
    TURN_LOGIC_COLOR:"/TS/TURNCOLOR"
   };

   function mqtt_publish(data,topic_name,station){
    var connectOpts = {
      username: mqttConfig.username,
      password: mqttConfig.password,
      port: mqttConfig.port,
      host: mqttConfig.host,
      rejectUnauthorized :  mqttConfig.rejectUnauthorized,
      clientId: mqttConfig.clientId+ new Date().getTime(),
      clean: mqttConfig.clean
    };
    var pubOpts = { qos: 0, retain: true };

    var client  = mqtt.connect(connectOpts);

    client.on('connect', function () {
      client.subscribe(station+topic_name, function (err) {      
  if (!err) {
          client.publish(station+topic_name, JSON.stringify(data),pubOpts);
   }
       });
    });
   
    client.on('message', function (topic, message) {
      client.end();
    });

   }
module.exports={
  mqtt_publish : mqtt_publish,
  MQTT_TOPIC_NAME:MQTT_TOPIC_NAME
};
