
var UrbanAirship = require("urban-airship");
var db = require('../../../../dbConnection');
var config = require('config');
var deviceLog = require('./deviceLog');
var Agenda = require('agenda');
var dbConfig = config.get('configVariables.mongoDB');
// Use Below for Digital, Spicejet
var mongoConnectionString = 'mongodb://' + dbConfig.userName + ':' + dbConfig.password + '@' + dbConfig.host + ':' + dbConfig.port + '/totem_dev?authSource=admin'; 
var ObjectID = require('mongodb').ObjectID;
// Use Below for Prod, ANZ and RTA
// var mongoConnectionString = 'mongodb://localhost/totem_dev';
var agenda = new Agenda({ db: { address: mongoConnectionString } });
var URCredentials = config.get('configVariables.urbanAirship');
var UAInstance = new UrbanAirship(URCredentials.apiKey, URCredentials.apiSecretKey, URCredentials.apiMasterKey);
var marshalQuery = 'id, token, active, date, user_id "userId", device_type "deviceType", created_at "createdAt", created_by "createdBy", modified_at "modifiedAt", modified_by "modifiedBy"';
exports.register = function (req) {
    var deviceInfo = req;
    function findUser() {
        var query = 'select * from user_master where id = ' + deviceInfo.userId;
        db.any(query).then(function (result) {
            if (result.length === 0) {
                // res.status(400).json({ 'error': 'user not found' });
                // return
                console.log("user not found");
            }
            getDevice();
        }).catch(function (err) {
            //res.status(400).json(err);
            console.log(err);

        });
    }
    findUser();
    function getDevice() {
        var query = "select * from device_log where token = '" + deviceInfo.token + "'";
        db.any(query).then(function (devices) {
            if (devices.length > 0) {
                getUserDevice(devices);
                return;
            }
            saveDeviceLog();
        }).catch(function (err) {
           // res.status(400).json(err);
           console.log(err);
        });
    }
    function getUserDevice(devices) {
        var otherDevices = [], existDevice = null;
        for (var i = 0; i < devices.length; i++) {
            if (devices[i].user_id === Number(deviceInfo.userId)) {
                existDevice = devices[i];
                continue;
            }
            if (devices[i].active === 'Y') {
                otherDevices.push(devices[i].id);
            }
        }
        makeInactive(otherDevices);
        if (!!existDevice) {
            makeActive(existDevice);
            return;
        }
        saveDeviceLog();
    }
    function saveDeviceLog() {
        var query = "insert into device_log (date,user_id,token,device_type, active,created_by,created_at,modified_by,modified_at) values (now(),'" + deviceInfo.userId + "','" + deviceInfo.token + "','" + deviceInfo.deviceType + "','Y','" + deviceInfo.userId + "',now(),'" + deviceInfo.userId + "',now()) RETURNING id";
        db.one(query).then(function (result) {
            sendResponse(result.id);
        }).catch(function (err) {
            // res.status(400).json(err);
            console.log(err);
        });
    }
    function makeActive(device) {
        var query = "update device_log set active = 'Y' , modified_at = now() where id = " + device.id + " RETURNING id";
        db.one(query).then(function (result) {
            sendResponse(result.id);
        }).catch(function (err) {
            // res.status(400).json(err);
            console.log(err);
        });
    }
    function makeInactive(devices) {
        if (devices.length === 0) return;
        var query = "update device_log set active = 'N' , modified_at = now() where id in (" + devices.join() + ")";
        db.any(query).then(function (data) {
        }).catch(function (err) {
        });
    }
    function sendResponse(id) {
        var query = 'select ' + marshalQuery + ' from device_log where id =' + id;
        db.one(query).then(function (result) {
            // res.status(200).json(result)
            console.log(result);
        }).catch(function (err) {
            // res.status(400).json(err);
            console.log(err);

        });
    }
};
exports.unRegister = function (req, res) {
    console.log(req.body);
    if (!(req.body.token && req.body.userId)) {
        res.status(400).json({ 'error': (!!req.body.userId ? 'userId' : 'token') + ' is required' });
        return;
    }
    var query = "update device_log set active = 'N' , modified_at = now() where token ='" + req.body.token + "' and user_id = '" + req.body.userId + "'";
    db.any(query).then(function (device) {
        res.status(200).json({ 'success': 'Device has been unregistered successfully' });
    }).catch(function (err) {
        res.status(400).json(err);
    });
};
exports.sendAlert = function (req, res) {
    if (!(req.body.alert && req.body.users && req.body.users.length > 0)) {
        res.status(400).json({ 'error': 'invalid parameters' });
        return;
    }
    deviceLog.sendAlertByUser(req.body.users, req.body.alert, function (err, result) {
        if (err) {
            res.status(400).json(err);
            return;
        }
        res.status(200).json(JSON.parse(result));
    });
};
exports.sendAlertByUser = function (users, alert, extras, notificationFor, next) {
    console.log("user_id",users);
    var query = "select * from device_log where user_id in (" + users + ") and active = 'Y'";
    console.log("query",query);
    db.any(query).then(function (result) {
        console.log("query result",result);
        deviceLog.pushNotification(result, alert, extras, notificationFor, function (err, devices) {
            if (next) {
                next(err, devices);
            }
        });
    }).catch(function (err) {
        next(err, null);
    });
};
exports.pushNotification = function (deviceLogs, alert, extras, notificationFor, next) {
    console.log(deviceLogs,"pushNotification device logs");
    if (deviceLogs.length === 0) {
        return;
    }
    var android_channel = [],ios_channel=[], count = 1;
    for (var i = 0; i < deviceLogs.length; i++) {
        var device_type = deviceLogs[i].device_type;
        if (device_type.toLowerCase() === 'android' && android_channel.indexOf(deviceLogs[i].token) === -1) {
            android_channel.push(deviceLogs[i].token);
        }
        if (device_type.toLowerCase() === 'ios' && ios_channel.indexOf(deviceLogs[i].token) === -1) {
            ios_channel.push(deviceLogs[i].token);
        }
    }
    console.log("tokens",ios_channel,android_channel);
    var payload;
    var aud ;
    if(android_channel.length==0){
     aud=  {  "ios_channel" : ios_channel };
    }
    if(ios_channel.length ==0){
        aud={"android_channel": android_channel};
    }
    if(android_channel.length>0 && ios_channel.length>0){
        // aud={
        //     "ios_channel" : ios_channel,
        //     "android_channel": android_channel
        // }

        aud = {
            "OR": [
                {
                    "ios_channel":ios_channel
                },
                {
                    "android_channel": android_channel
                }
            ]
        };
    }
    if (notificationFor == 'taskReassign') {
        payload = {
            'audience': aud,
            'notification': {
                'alert': alert,
                'android': {
                    'extra': {
                        'reassignJson': JSON.stringify(extras)
                    }
                },
                'ios': {
                    'extra': {
                        'reassignJson': JSON.stringify(extras)
                    }
                },
                'interactive': {
                    'type': 'ua_accept_decline_foreground',
                    'button_actions': {
                        'accept': {
                            'add_tag': 'accept',
                        },
                        'decline': {
                            'add_tag': 'remove'
                        }
                    }
                }
            },
            'device_types': ['android','ios']
        };
    }
    else {

        payload = {
            'audience': aud,
            'notification': {
                'alert': alert,
                'android': {
                    'extra': {
                        'etaCron': JSON.stringify(extras)
                    }
                },
                'ios': {
                    'extra': {
                        'etaCron': JSON.stringify(extras)
                    }
                },
            },
            'device_types': ['android','ios']
        };
    }
    pushNotification();
    function pushNotification() {
        if (notificationFor == 'taskReassign') {
            var id = extras.res_id + "_" + extras.task_reassignId;
            var task_reassignId = extras.task_reassignId;
            agenda.schedule('in 1 minutes', 'timeoutReassignTask', { 'alert':alert, 'id':id,'task_reassignId' :task_reassignId, 'extras': extras });
            agenda.start();
        }
        console.log("PUSH PAYLOAD", payload);
        UAInstance.pushNotification('/api/push/', payload, function (err, result) {
            console.log("PUSH RESULT", result, err);
            if (err) {
                err = String(err);
                err = err.substr(7, err.length);
                err = JSON.parse(err);
                if (err.error_code === 40285 && payload.audience.android_channel.length > 0) {
                    handleInvalidTokenError(err);
                    return;
                }
            }
            handleSuccess(err, result);
        });
        function handleInvalidTokenError(err) {
            var errorStr = err.details.error.split("'").join('');
            var errorStrArray = errorStr.split(' ');
            var channelId = errorStrArray[errorStrArray.length - 1];
            var channelIdIndex = payload.audience.android_channel.indexOf(channelId);
            if (!!channelId && channelIdIndex > -1) {
                payload.audience.android_channel.splice(channelIdIndex, 1);
                count++;
                pushNotification();
                return;
            }
            handleSuccess(err, null);
        }
        function handleSuccess(err, result) {
            if (result) {
            }
            next(err, result);
        }
    }
    agenda.define('timeoutReassignTask', { priority: 'high', concurrency: 10 }, function (job, done) {
        console.log("Push Time out", job.attrs.data.alert);
        var q = 'update task_reassign set expiry = true where id = ' + job.attrs.data.task_reassignId + '';
        db.none(q);
        var pubOpts = { qos: 1, retain: true };
        var content = job.attrs.data.extras.userId.userName + " has timeout  of " + job.attrs.data.extras.taskName + " for " + job.attrs.data.extras.flightNumber;
        var triggerAlert = (job.attrs.data.extras.userId.reassignFrom == 0) ? "web" : "mobile";
        if (triggerAlert == "web") {
            client.publish("MAA/TASK_REASSIGN_STATUS", JSON.stringify(content), pubOpts);
        }
        else {
            deviceLog.sendAlertByUser([job.attrs.data.extras.userId.reassign_by], content, job.attrs.data.extras, "triggerAlert", function (err, result) {
            });
        }

        done();
    });
};
