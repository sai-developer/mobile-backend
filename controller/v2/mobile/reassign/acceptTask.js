var query = require('../utils/query');
var db = require('../../../../dbConnection');
var config = require('config');
var Agenda = require('agenda');
var err = require('../utils/error_msg');
var deviceLog = require('../common_service/deviceLog');
const dbConfig = config.get('configVariables.mongoDB');
var mongoConnectionString = 'mongodb://' + dbConfig.userName + ':' + dbConfig.password + '@' + dbConfig.host + ':' + dbConfig.port + '/totem_dev?authSource=admin'; const ObjectID = require('mongodb').ObjectID;
// var mongoConnectionString = 'mongodb://localhost/totem_dev';
var agenda = new Agenda({ db: { address: mongoConnectionString } });

function pushReassignAccept(req, res, next) {
     var task_reassignId = req.body.extras.task_reassignId;
     var query = 'update task_reassign set status = ' + req.body.status + ' where id = ' + req.body.extras.task_reassignId;
     db.tx(t => {
        var query = 'update task_reassign set status = ' + req.body.status + ' where id = ' + req.body.extras.task_reassignId;
        if (req.body.status == 1) {
        db.none('update resource_mapping set USER_ID=$2 where id=$1', [req.body.extras.res_id, req.body.extras.to]);
        }
                            var id = req.body.extras.res_id + "_" + req.body.extras.task_reassignId;
                            agenda.cancel({ "data.id": id },
                                (err, num) => console.log("agenda error ", err, num)
                            );         
        })
        .then(function () {
            var pubOpts = { qos: 1, retain: true };
            var us= (req.body.status== 1) ? "accepted" :"rejected"
            var content = req.body.extras.userName +" has "+us+"  of " + req.body.extras.taskName +" for "+  req.body.extras.flightNumber;
            var code =  req.body.extras.code;
            client.publish(code+"/TASK_REASSIGN_STATUS",JSON.stringify(content), pubOpts);
                //send push notification mobile
                deviceLog.sendAlertByUser(req.body.extras.from, content,req.body, "triggerAlert", function (err, result) {
                })
            res.status(200)
                .json({
                    status: true,
                    successMessage: 'Record updated Successfully'
                });
        })
        .catch(function (err) {
            res.status(200)
                .json({
                    status: false,
                    errorMessage: err.message
                });
        });
}

module.exports = {
    pushReassignAccept: pushReassignAccept
};