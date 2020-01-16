var query = require('../utils/query');
var db = require('../../../../dbConnection');
var err = require('../utils/error_msg');
var _ = require('underscore');


function getTaskByUserId(req, res, next) {

    var paramExists =
        ((typeof req.query.user_id != 'undefined' && req.query.user_id != '') &&
            (typeof req.query.timezone != 'undefined' && req.query.timezone != '')) ? true : false;

    if (paramExists) {
        var user_id = req.query.user_id;
        var timezone = req.query.timezone; 
        console.log("quey");
        db.any(query.getTaskByUserId, [user_id, timezone]).then(function (data) {
            if (data.length > 0) {
                var my_team = null;
                var flights = [];
                var completed_flight = [];
                var Array1 = '';
                /* List of flights assigned by user*/
                for (var i = 0; i < data.length; i++) {
                    if (data[i].atd == null) {
                        data[i].completed = null;
                        data[i].inprogress = null;
                        var x = {
                            "f_id": data[i].f_id,
                            "a_f_no": data[i].a_f_no != null ? data[i].a_f_no : '--',
                            "d_f_no": data[i].d_f_no != null ? data[i].d_f_no : '--',
                            "t_count": data[i].task_details == null ? 0 : data[i].task_details.length
                        };
                        Array1 += "'" + data[i].f_id + "',";
                        flights.push(x);
                    }
                    else {
                        var c = {
                            "f_id": data[i].f_id,
                        };
                        completed_flight.push(c);
                    }

                    /* split inprogress and completed task */
                    var inprogress = [],
                        completed = [];

                    for (var j = 0; j < data[i].task_details.length; j++) {
                        if (data[i].task_details[j].t_atd != null || data[i].task_details[j].u_s == true) {
                            completed.push(data[i].task_details[j]);
                        } else {
                            inprogress.push(data[i].task_details[j]);
                        }
                    }

                    data[i].completed = completed.length == 0 ? null : completed;
                    data[i].inprogress = inprogress.length == 0 ? null : inprogress;
                    data[i].my_team = _.uniq(data[i].my_team, function (x) {
                        return x.id;
                    });
                    // if(data[i].my_team.length === 1){
                    //      data[i].my_team  == null
                    // }
                    delete data[i].task_details;

                }
                Array1 = Array1.substring(0, Array1.length - 1);

                my_teams(Array1, function (details) {
                    var d = data;
                    for (var index = 0; index < d.length; index++) {

                        var element = d[index];
                        if (element.completed !== null) {
                            element.completed.sort(function (a, b) {
                                return a.t_seq - b.t_seq;
                            });
                        }
                        if (element.inprogress !== null) {
                            element.inprogress.sort(function (a, b) {
                                return a.t_seq - b.t_seq;
                            });
                        }

                        element.my_team = [];
                        if(details !=null){
                        for (var i = 0; i < details.length; i++) {
                            var ele1 = details[i];
                            if (element.f_id == ele1.flight_schedules_id && parseInt(user_id) !== parseInt(ele1.user_id)) {
                                var obj = {};
                                obj.id = ele1.user_id;
                                obj.f_n = ele1.first_name;
                                obj.l_n = ele1.last_name;
                                element.my_team.push(obj);
                            }
                        }
                    }

                    }
                    var flight = [];
                    for (var s = 0; s < d.length; s++) {
                        if (d[s].atd == null) flight.push(d[s]);
                    }
                    res.status(200)
                        .json({
                            status: true,
                            flights: flights,
                            c_f: completed_flight,
                            flights_details: flight
                        });
                });
            } else {
                res.status(200)
                    .json({
                        status: false,
                        errMsg: err.NO_TASK_FOUND
                    });
            }
        }).catch(function(err){
            res.status(505).json({status:false,err:"err in main"+err})
        });
    } else {

        res.status(200)
            .json({
                status: false,
                errMsg: "user_id and timezone required.. Some Params are missing.. Please check."
            });

    }
}

function my_teams(f_id, callback) {
    console.log(f_id)
    if (f_id != null) {
        db.any('select distinct(rm.user_id),um.first_name,um.last_name,rm.flight_schedules_id from resource_mapping rm ' +
            'JOIN user_master um ON um.id = rm.user_id and rm.flight_schedules_id in (' + f_id + ')').then(function (team_data) {
                my_team = team_data;
                callback(my_team);
            }).catch(function(err){
                console.log("My team error");
                callback(null)
            });;
    }
    else {
        callback(null);
    }
}

module.exports = {
    getTaskByUserId: getTaskByUserId
};

