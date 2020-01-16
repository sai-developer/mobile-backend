var query = require('../utils/query');
var err = require('../utils/error_msg');
var db = require('../../../../dbConnection');
var deviceLog = require('../common_service/deviceLog');


function login(req, res, next) {
    var username = req.body.userId;
    var password = req.body.pwd;
    var paramExists =
        ((typeof req.body.userId != 'undefined' && req.body.userId != '') &&
            (typeof req.body.pwd != 'undefined' && req.body.pwd != '')) ? true : false;
    if (paramExists) {
        // log.log("Mobile Login", query.login)
        db.any(query.login, [username, password]).then(function (data) {
            var user_data,fuel,taskDelayCodeMap;
            if (data.length>0) {
                user_data= data[0];
                let obj = {}
                obj.userId = user_data.id
                obj.token = req.body.token
                obj.deviceType = req.body.device_type
                console.log(obj)
                deviceLog.register(obj)
                user_data.airportCode = user_data.iata; 
                delete user_data.iata;
                updateUserLocation(req.body.user_id,req.body.lat,req.body.lng)
              db.any(query.getFuelReason, [username, password]).then(function (fuel_data) {
                  if(fuel_data.length>0){
                    fuel=fuel_data;
                    db.any(query.gettaskDelayCodeMapping, [username, password]).then(function (delay_data) {
                        if(fuel_data.length>0){
                            taskDelayCodeMap=delay_data;
                            let array = [];
                            let obj = {};
                            for (let index = 0; index < taskDelayCodeMap.length; index++) {
                                const element = taskDelayCodeMap[index];
                               
                                for (let t = 0; t < element.dly_codes.length; t++) {
                                    const ele = element.dly_codes[t];
                                    ele.dnc = ele.dnc.trim()
                                    if(ele.dac == null) {
                                        ele.dac = "";
                                    }
                                }
                                element.dly_codes.sort(function(a, b){return b.def > a.def});
                                //obj["t_id_" + element.t_id] = element.dly_codes;
                                //obj
                            }
                            var x= {
                                user_data: user_data,
                                fuel:fuel,
                                taskDelayCodeMap:taskDelayCodeMap
                            }
                            res.status(200)
                            .json({
                                status: true,
                                res:x

                            });
                        }

                    });
                  }

              });
            }
            else {
                res.status(200)
                    .json({
                        status: false,
                        errMsg: err.LOGIN_ERROR
                    });
            }

        })
            .catch(function (err) {
                // log.log("Mobile Login", err)
                res.status(200)
                    .json({
                        status: false,
                        errMsg: err
                    });
            });
    }
    else {
        res.status(200)
            .json({
                status: false,
                errMsg: err.LOGIN_EMPTY
            });
    }
}
/* Update user location */
function updateUserLocation(user_id, latitude, longitude) {
    var q = query.update_lat_lng;
    db.any(q, [latitude, longitude, user_id])
        .then(function (data) {
            // log.log('Login location', 'Location updated successfully')
        })
        .catch(function (err) {
            // log.log('Login location', err)
        });
}

function logout(req, res, next) { 
        deviceLog.unRegister(req,res)
}    
module.exports = {
    login : login,
    logout:logout
}