var db = require('../../../../dbConnection');
var airportTimezone = require('airport-timezone');
var _ = require('underscore');
var query = require('../utils/query');
var moment = require('moment');

function getTaskCompletedListByUserId(req, res, next) {
    // var start = req.query.from;
    // var end = req.query.to;

    if (typeof req.query.id != 'undefined' && req.query.id != '' && (typeof req.query.timezone != 'undefined' && req.query.timezone != '')) {
        var userId = req.query.id;
        var zone = req.query.timezone;
        // var date = moment(req.query.date).format('DD-MMM-YYYY').toString();
        // var date = moment(req.query.date).tz(zone).startOf('day').utc().format();
        // var currDate = moment.tz(zone).utc().format('YYYY-MM-DD').toString();
        var date = req.query.date;
        db.any(query.task_completed_list, [userId, zone, date]).then(function (resData) {
            var data = [];
            if (resData.length > 0) {
                data = resData.filter(
                    flt => flt.atd !== null);
                for (let index = 0; index < data.length; index++) {
                    const element = data[index];
                    element.taskLen = element.task.length;
                    for (let i = 0; i < element.task.length; i++) {
                        // const tskElement = element.task[i];
                        element.task = element.task.filter(
                            tsk => tsk.t_atd !== null || tsk.u_s == true);
                    }
                }
                var my_team;
                var flights = [];
                var flights_details = [];
                var tasks = [];
                var Array1 = '';
                /* List of flights assigned by user*/
                if (data.length > 0) {
                    for (var i = 0; i < data.length; i++) {
                        tasks = data;
                        var x = {
                            "f_id": data[i].f_id,
                            "a_f_no": data[i].a_f_no != null ? data[i].a_f_no : '--',
                            "d_f_no": data[i].d_f_no != null ? data[i].d_f_no : '--',
                            "t_count": data[i].taskLen
                            // "t_count": data[i].task.length
                        }
                        Array1 += "'" + data[i].f_id + "',"
                        flights.push(x);
                        delete data[i].taskLen
                    }
                }
            }
            res.status(200)
                .json({
                    status: true,
                    flights: flights,
                    flights_details: data,
                    // query: query.task_completed_list
                });
        })
    }
}
module.exports = {
    getTaskCompletedListByUserId: getTaskCompletedListByUserId,
};