var query = require('../utils/query');
var db = require('../../../../dbConnection');
var err = require('../utils/error_msg');
var deviceLog = require('../common_service/deviceLog');

function reAssign(req, res, next) {
    flightInfo = null; var tasksByUser = [];
    db.one(
            /* insert into task reassign table*/
             'INSERT INTO task_reassign(resource_mapping_id,user_id,reassign_by,\
                    active,created_at) VALUES\
                    (' + req.body.res_id + ',' + req.body.to + ',' + req.body.from + ',' + '\'Y\'' + ',now()) RETURNING ID'
    )
        .then(function (data) {
                req.body.task_reassignId = data.id;
            res.status(200)
                .json({
                    status: true,
                    successMessage: 'Record updated Successfully'
                });
                getFlightDetails();
        })
        .catch(function (err) {
            res.status(200)
                .json({
                    status: false,
                    errorMessage: err.message
                });
        });
    function getFlightDetails() {
        var query = "select fs.dep_flight_number,fs.arr_flight_number,tm.name,am.code,um.first_name, um.last_name from resource_mapping as rm INNER JOIN flight_schedules as fs ON fs.id = rm.flight_schedules_id INNER JOIN airport_master as am ON am.id = fs.station INNER JOIN task_schedule_details as tsd ON tsd.id = rm.task_schedule_detail_id INNER JOIN task_master as tm ON tm.id = tsd.task_id INNER JOIN user_master as um ON um.id = "+req.body.to+" where rm.id="+ req.body.res_id + " limit 1";
        db.one(query).then(function (result) {
            flightInfo = result;
            sendPushNotification();
        }).catch(function (err) {
        });
    }
    function sendPushNotification() {
        var flightNumber = flightInfo.dep_flight_number ? flightInfo.dep_flight_number : flightInfo.arr_flight_number;
        var taskName = flightInfo.name;
        var code = flightInfo.code;
        var userName = flightInfo.first_name +'\xa0'+flightInfo.last_name;
        var to_id = req.body.to;
        var res_mapping_id = req.body.res_id;
        var alert = flightNumber + ' - ' + taskName + ' has been assigned';
        tasksByUser.push({ task_reassignId: req.body.task_reassignId, res_id:res_mapping_id, code:code, userName:userName, taskName:taskName,flightNumber:flightNumber,to:to_id,from:req.body.from});
        deviceLog.sendAlertByUser(to_id, alert, tasksByUser, "taskReassign", function (err, result) {
                            })
    }
}
module.exports = {
    reAssign: reAssign
};