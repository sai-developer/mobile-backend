var util = require('../common_service/flight_schedule_details_update');
var query = require('../utils/query');
var db = require('../../../../dbConnection');
var config = require('config');
var mqtt = require('../utils/mqtt');
var async = require('async');
var moment = require('moment');
var _ = require('underscore');
var pgp = require('pg-promise')({
    /* initialization options */
    capSQL: true // capitalize all generated SQL
});
var insert_query1 = 'insert into task_status (resource_mapping_id,a_start_time,a_end_time,delay_code_id,delay_reason,skipped,carrier_type,latitude,longitude,created_by,delay_start_time,delay_end_time,created_at,active,flight_flag,e_start_time,e_end_time) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),\'Y\',$13,$14,$15) returning id as task_status_id,resource_mapping_id';
var update_query1 = 'update task_status set resource_mapping_id=coalesce($1,resource_mapping_id),a_start_time=$2,a_end_time=$3,delay_code_id=$4,delay_reason=$5,skipped=$6,carrier_type=$7,latitude=$8,longitude=$9,modified_by=$10,delay_start_time=$11,delay_end_time=$12,modified_at=NOW(),active=\'Y\',flight_flag=$13,e_start_time=$14,e_end_time=$15 where resource_mapping_id=$1 and a_start_time is not null returning id as task_status_id,resource_mapping_id';
var chockson = "Chocks on";
var chocksoff = "Chocks off";
function taskStart(req, res, next) {
    console.log(req.body, "Mobile JSON request")
    updateUserLocation(req.body.u_id, req.body.lat, req.body.lon);
    var query;
    var paramExists =
        ((typeof req.body.res_id != 'undefined' && req.body.res_id != '')) ? true : false;
    if (paramExists) {
        var q = 'SELECT * FROM TASK_STATUS WHERE RESOURCE_MAPPING_ID = ' + parseInt(req.body.res_id);
        db.any(q).then(function (data) {
            if (data.length > 0) {
                query = update_query1;
            } else {
                query = insert_query1;
            }
            executeQuery(query, req, res);
        });
    }
    if (req.body.fuelInfo !== undefined) {
        furlUpdate(req.body.fuelInfo, req.body.f_S_Id);
    }
}
function executeQuery(query, req, res) {
    var color_flag;
    var buffer;
    //buffer calculation in seconds
    buffer = (req.body.t_d == 0) ? (req.body.t_d + (30 * 1000)) : (req.body.t_d * (0.1 * 60 * 1000));
    var act_e = ((typeof req.body.a_e_t === 'undefined') && (req.body.a_e_t === null)) ? null : (moment(req.body.a_e_t).unix() * 1000);
    var act_s = ((typeof req.body.a_s_t === 'undefined') && (req.body.a_s_t === null)) ? null : (moment(req.body.a_s_t).unix() * 1000);
    var planned_e = ((typeof req.body.e_e_t === 'undefined') && (req.body.e_e_t === null)) ? null : (moment(req.body.e_e_t).unix() * 1000);
    var PET_B = planned_e + buffer;
    var e_c = (typeof req.body.a_e_t === 'undefined') || req.body.a_e_t === null ? null : req.body.a_e_t;
    //to find type of task action
    var task_action = (req.body.e_s_t != null && req.body.e_e_t != null && req.body.a_s_t != null && e_c === null) ? 'task_start' : 'task_end';
    console.log(task_action, "action task");
    //to find color for swipped task
    var ontime_start = act_s <= planned_e;
    var buffer_start = act_s > planned_e && act_s <= PET_B;
    var ontime_end = act_e <= planned_e;
    var buffer_end = act_e > planned_e && act_e <= PET_B;
    color_flag = ("task_start" ? (ontime_start ? 0 : (buffer_start ? 2 : 1)) : (ontime_end ? 0 : (buffer_end ? 2 : 1)))
    db.any(query, [parseInt(req.body.res_id), (typeof req.body.a_s_t === 'undefined') || req.body.a_s_t === null ? null : req.body.a_s_t,
    (typeof req.body.a_e_t === 'undefined') || req.body.a_e_t === null ? null : req.body.a_e_t,
    (typeof req.body.d_id === 'undefined' || req.body.d_id === null || isNaN(req.body.d_id)) ? null : parseInt(req.body.d_id),
    (typeof req.body.d_reason === 'undefined') || req.body.d_reason === null ? null : req.body.d_reason,
    (typeof req.body.u_skipped === 'undefined' || req.body.u_skipped === '') ? false : req.body.u_skipped,
    (typeof req.body.c_type === 'undefined' || req.body.c_type === '') ? null : req.body.c_type,
    (typeof req.body.lat === 'undefined') || req.body.lat === null ? null : req.body.lat,
    (typeof req.body.lon === 'undefined') || req.body.lon === null ? null : req.body.lon,
    req.body.u_id,
    (typeof req.body.d_s_t === 'undefined') || req.body.d_s_t === 0 ? null : parseInt(req.body.d_s_t),
    (typeof req.body.d_e_t === 'undefined') || req.body.d_e_t === 0 ? null : parseInt(req.body.d_e_t), color_flag,
    (typeof req.body.e_s_t === 'undefined') || req.body.e_s_t === null ? null : req.body.e_s_t,
    (typeof req.body.e_e_t === 'undefined') || req.body.e_e_t === null ? null : req.body.e_e_t,
    ]).then(function (data) {
        // var query = 'SELECT TASK_COMPLETED_COUNT as tc, station_airport_code as station, FLIGHT_TYPE FROM task_status_summary_by_flight_sched_id_v WHERE flight_schedules_id = ' + parseInt(req.body.f_S_Id);
        var query = "select aa.code as station, aa.flight_type, \
            count(aa.task_completed_flag) as tc from (select CASE WHEN b.a_end_time IS NOT NULL THEN 1 ELSE NULL::integer END AS task_completed_flag, \
            e.code, a.flight_type from flight_schedules a \
            LEFT JOIN task_schedule_details c ON a.task_schedule_id = c.task_schedule_id AND c.active= 'Y'\
            LEFT JOIN resource_mapping d on d.task_schedule_detail_id = c.id AND d.flight_schedules_id = a.id AND d.active= 'Y'\
            left join task_status b ON b.resource_mapping_id = d.id AND b.active= 'Y'\
            join airport_master e on e.id = a.station \
            where a.id in ($1)) \
            as aa group by aa.code, aa.flight_type";
        var isTaskStart = (typeof req.body.a_e_t != 'undefined' && (req.body.a_e_t === null || req.body.a_e_t === ''));
        var isTaskSkipped = req.body.u_skipped;
        if (!isTaskStart || isTaskSkipped) {
            db.any(query, [parseInt(req.body.f_S_Id)])
                .then(function (data) {
                    req.body.flightType = data && data[0] ? data[0].flight_type : null;
                    req.body.station = data && data[0] ? data[0].station : '';
                    checkTerminatingComplete(req, res, function (err, data1) {
                        if (data1 && data1[0] && data1[0].completed) {
                            req.body.completed = true;
                            req.body.station = data && data[0] ? data[0].station : '';
                            updatePendingTasks(req, res);
                        } else {
                            req.body.completed = req.body.completed ? req.body.completed : false;
                        }
                        req.body.taskCompletedCount = data[0].tc;
                        mqttPublish(req, mqtt.MQTT_TOPIC_NAME.TASK_COMPLETE);
                        if (req.body.t_name != chockson) {
                            mqttPublish(req, mqtt.MQTT_TOPIC_NAME.TURN_LOGIC_COLOR);
                        }
                        if (req.body.t_name === chockson) {
                            util.updateAta(req.body.f_S_Id, req.body.a_s_t, function (status, msg) {
                                mqttPublish(req, mqtt.MQTT_TOPIC_NAME.CHOCKS_ON);
                                mqttPublish(req, mqtt.MQTT_TOPIC_NAME.TURN_LOGIC_COLOR);
                            });
                        } else if (req.body.t_name == chocksoff) {
                            util.updateAtd(req.body.f_S_Id, req.body.a_e_t, function (status, msg) {
                                mqttPublish(req, mqtt.MQTT_TOPIC_NAME.CHOCKS_OFF);
                                mqttPublish(req, mqtt.MQTT_TOPIC_NAME.TASK_ASSIGN_V2);
                            });
                        }
                    });
                })
                .catch(function (err) {
                    console.log("task_action ", err);
                });
        }
        res.status(200)
            .json({
                status: true,
                data: data,
                successMessage: "success"
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
function furlUpdate(fuel, fid) {
    var q = 'update flight_schedules set total_fuel =$1, trip_fuel =$2, extra_fuel =$3, fuel_reason =$4 where id = $5';
    db.result(q,
        [
            (typeof fuel.t_F === 'undefined' || fuel.t_F === null) ? null : fuel.t_F,
            (typeof fuel.tr_F === 'undefined' || fuel.tr_F === null) ? null : fuel.tr_F,
            (typeof fuel.e_F === 'undefined' || fuel.e_F === null) ? null : fuel.e_F,
            (typeof fuel.f_R === 'undefined' || fuel.f_R === null) ? null : fuel.f_R,
            fid
        ])
        .then(function (data) {
            //   res.status(200)
            //   .json({
            //     query : q,
            //     status: true,
            //     successMessage: 'Fuel Information updated succesfully'
            //   });
        })
        .catch(function (err) {
            //  res.status(200)
            // .json({
            //   query:q,
            //   status: false,
            //   errorMessage: err
            // });
        });
}
function updatePendingTasks(req, res) {
    db.any('SELECT * FROM TASK_SCHED_RES_MAPPING_V WHERE RESOURCE_MAPPING_ID IN (SELECT ID FROM RESOURCE_MAPPING WHERE flight_schedules_id = $2) AND TASK_ACTUAL_END_TIME IS NULL AND TASK_ACTUAL_START_TIME IS NOT NULL',
        [parseInt(req.body.a_e_t), parseInt(req.body.f_S_Id)])
        .then(function (data) {
            if (data && data.length > 0) {
                for (var i = 0; i < data.length; i++) {
                    var data1 = {};
                    data1.userId = data[i].u_id;
                    data1.name = data[i].name;
                    data1.taskDuration = data[i].task_duration;
                    data1.taskActualStartTime = new Date(data[i].task_actual_start_time).getTime();
                    data1.taskActualEndTime = req.body.a_e_t;
                    data1.taskName = data[i].task_name;
                    data1.resourceMappingId = data[i].res_id;
                    data1.flightSchedulesId = req.body.f_S_Id;
                    data1.completed = req.body.completed ? req.body.completed : false;
                    var topic = "/TS/UPDATE";
                    mqtt.mqtt_publish(JSON.stringify(data1), topic, req.body.station);
                }
            }
        })
        .catch(function (err) {
            console.log("updatePendingTasks Error message ", err);
        });
}
function checkTerminatingComplete(req, res, cbk) {
    var termFlightComp = config.get('dataConfig.flightCompleted')["3"];
    if (req.body.flightType == 3 && (req.body.t_name == termFlightComp[0] || req.body.t_name == termFlightComp[1])) {
        var query = 'select true "completed" where (select true from task_sched_res_mapping_v where task_name = $1 and flight_schedules_id = $3 and flight_type= 3 and task_actual_end_time IS NOT NULL) and (select true from task_sched_res_mapping_v where task_name = $2 and flight_schedules_id = $3 and flight_type = 3 and task_actual_end_time IS NOT NULL)';
        db.any(query, [termFlightComp[0], termFlightComp[1], parseInt(req.body.f_S_Id)])
            .then(function (data) {
                cbk(null, data);
            })
            .catch(function (err) {
                cbk(err, null);
            });
    } else {
        cbk(null, null);
    }
}
function mqttPublish(req, topic) {
    console.log("mqttPublish");
    var station = req.body.station;
    var end_time, start_time;
    var planned_start_time, planned_end_time;
    var turn_t;
    var inprogress_task;
    if (topic === mqtt.MQTT_TOPIC_NAME.TURN_LOGIC_COLOR) {
        // var qy = 'SELECT fs.turn_time FROM flight_schedules as fs inner join resource_mapping as rm on rm.flight_schedules_id=fs.id \
        // inner join task_status as ts on ts.resource_mapping_id = rm.id WHERE id=' + req.body.f_S_Id;
        var qy = "SELECT fs.turn_time, fs.id,count(case when (ts.a_start_time is not null and ts.a_end_time is null) then 1 end) as progress_task FROM flight_schedules as fs inner join resource_mapping as rm on rm.flight_schedules_id=fs.id \
        inner join task_status as ts on ts.resource_mapping_id = rm.id WHERE fs.id="+ req.body.f_S_Id + "group by fs.turn_time,fs.id"
        console.log("qy", qy);
        db.any(qy).then(function (datas) {
            for (var x = 0; x < datas.length; x++) {
                if (datas[x].turn_time != null) {
                    turn_t = moment(datas[x].turn_time).unix() * 1000;
                }
                inprogress_task = datas[x].progress_task;
            }
        });
    }
    if (req.body.a_e_t !== null && req.body.a_e_t !== undefined) {
        end_time = moment(req.body.a_e_t).unix() * 1000;
    } else {
        end_time = null;
    }
    if (req.body.a_s_t !== null && req.body.a_s_t !== undefined) {
        start_time = moment(req.body.a_s_t).unix() * 1000;
    } else {
        start_time = null;
    }
    if (req.body.e_e_t !== null && req.body.e_e_t !== undefined) {
        planned_end_time = moment(req.body.e_e_t).unix() * 1000;
    } else {
        planned_end_time = null;
    }
    if (req.body.e_s_t !== null && req.body.e_s_t !== undefined) {
        planned_start_time = moment(req.body.e_s_t).unix() * 1000;
    } else {
        planned_start_time = null;
    }
    var message = {
        "status": true,
        "successMessage": "data fetched",
        "data": {
            "flightSchedulesId": req.body.f_S_Id,
            "userId": req.body.u_id,
            "name": null,
            "resourceMappingId": req.body.res_id,
            "taskDuration": req.body.t_d,
            "taskActualStartTime": start_time,
            "taskActualEndTime": end_time,
            "delayReason": "",
            "delayCodeMaster": {
                "id": (req.body.d_id) ? req.body.d_id : null
            },
            "taskName": req.body.t_name,
            "e_start_time": planned_start_time,
            "e_end_time": planned_end_time,
            "delay_start_time": 0,
            "delay_end_time": 0,
            // "latitude": req.body.lat,
            // "longitude": req.body.lon,
            "flightType": req.body.flightType,
            "completed": req.body.completed,
            "taskCompletedCount": req.body.taskCompletedCount,
            "performed_by": null,
            "station": station
        }
    };
    if (topic === mqtt.MQTT_TOPIC_NAME.TASK_ASSIGN_V2) { var msg = null; message = msg; }
    console.log("Mqtt topic NAME ", topic);
    if (topic != mqtt.MQTT_TOPIC_NAME.CHOCKS_OFF && topic != mqtt.MQTT_TOPIC_NAME.TASK_ASSIGN_V2) {
        flag_check(req.body, function (c) {
            var flagGroup = _.pluck(c, "flight_flag");
            console.log(flagGroup, "Flag check res", "topic name ", topic)
            var final_color = _.contains(flagGroup, 1) ? 1 : (_.contains(flagGroup, 2)) ? 2 : 0;
            //end time update flight color in flight schedules table
            console.log("turn time and inprogress task", turn_t, inprogress_task, "topic name ", topic);
            if (req.body.t_name != "Chocks off") {
                var check_params = end_time != null && turn_t != null && inprogress_task != 0 && inprogress_task != null;
                var check_param = end_time != null && turn_t != null && inprogress_task == 0 || inprogress_task == null ;
                if (check_params) {
                    console.log("in progress tasks")
                    final_color = (check_params) ? ((end_time <= turn_t) ? final_color : 1) : final_color;
                } else if (check_param) {
                    console.log(" no in progress tasks")
                    final_color = (check_param) ? ((end_time <= turn_t) ? final_color : 1) : final_color;
                } else {
                    console.log("else")
                }
            }
            console.log("Final flog color", final_color);
            //UPDATE FLAG IN FLIGHT SCHEDULE TABLE
            updateFlightSchedule(req.body.f_S_Id, final_color);
            message.data.flight_flag = final_color;
            console.log("MQTT Msg Publish ", message, topic);
            if (topic === mqtt.MQTT_TOPIC_NAME.TURN_LOGIC_COLOR) {
                mqtt.mqtt_publish(message, topic, station);
                if (message.data.taskDuration != 0) {
                    mqtt.mqtt_publish(message, "/live_status", "handler")
                }
            } else {
                mqtt.mqtt_publish(message, topic, station);
            }
        })
    } else {
        console.log("message chocks", message)
        mqtt.mqtt_publish(message, topic, station);
    }
}
function flag_check(info, callback) {
    var color = [];
    if (info.t_name === "Chocks off") {
        var q2 = "select flight_flag from flight_schedules where id=" + info.f_S_Id
        db.any(q2).then(function (datas) {
            color.push(datas[0]);
        })
            .catch(function (err) {
                console.log("Error in checking Task status", err);
            });
    }
    var q1 = "select a.id, b.flight_flag from resource_mapping a \
    left join task_status b on b.resource_mapping_id=a.id \
    where b.flight_flag is not null AND b.a_end_time is null AND a.flight_schedules_id="+ info.f_S_Id
    db.any(q1).then(function (data) {
        if (info.t_name === "Chocks off") {
            data = ((color != null && color != undefined) ? color : data)
        }
        callback(data)
    })
        .catch(function (err) {
            console.log("Error in checking Task status", err);
        });
}
function updateFlightSchedule(f_id, color) {
    /* Turn login */
    var q = "UPDATE flight_schedules SET flight_flag=" + color + " " + "WHERE id=" + f_id
    db.any(q).then(function (data) {
    })
        .catch(function (err) {
            console.log("Error in updating flight schedules", err);
        });
}
function updateUserLocation(u_id, latitude, longitude) {
    var last_seen = '';
    var query = "update user_master set last_seen =NOW(), latitude =$1, longitude =$2 where id = $3";
    db.any(query, [latitude, longitude, u_id])
        .then(function (data) { })
        .catch(function (err) {
            console.log("Error updateUserLocation", err);
        });
}
function bulkTasks(req, res, next, callback) {
    console.log("BulkFullObject", JSON.stringify(req.body));
    var cs = new pgp.helpers.ColumnSet([
        '?resource_mapping_id',
        {
            name: 'delay_reason',
            default: '',
        },
        {
            name: 'active',
            default: '\'Y\''
        },
        {
            name: 'delay_code_id',
            default: null,
            cast: 'integer',
        },
        {
            name: 'skipped'
        },
        {
            name: 'a_start_time'
        },
        {
            name: 'a_end_time'
        },
        {
            name: 'delay_start_time',
            cast: 'integer'
        },
        {
            name: 'delay_end_time',
            cast: 'integer'
        },
        {
            name: 'latitude'
        },
        {
            name: 'longitude'
        },
        {
            name: 'carrier_type'
        }, {
            name: 'created_by'
        },
        {
            name: 'created_at'
        }
    ], {
            table: 'task_status'
        });
    var update_query = null;
    var insert_query = null;
    var val = req.body;
    var x = val.reduceRight(function (r, a) {
        r.some(function (b) {
            return a.res_id == b.res_id;
        }) || r.push(a);
        return r;
    }, []);
    async.forEach(x, function (d, callback) {
        if (d.fuelInfo !== undefined) {
            furlUpdate(d.fuelInfo, d.f_S_Id);
        }
        var query = 'SELECT * FROM TASK_STATUS WHERE RESOURCE_MAPPING_ID = ' + d.res_id;
        db.any(query).then(function (data) {
            var y = '';
            //  if (d.taskDuration == 0) {
            //      d.a_e_t = d.a_s_t
            //  }
            y = {
                resource_mapping_id: parseInt(d.res_id),
                delay_reason: (typeof d.d_reason === 'undefined') || d.d_reason === null ? null : d.d_reason,
                active: 'Y',
                delay_code_id: (typeof d.d_id === 'undefined' || d.d_id === null || isNaN(d.d_id) || d.d_id === 0) ? null : parseInt(d.d_id),
                skipped: (typeof d.u_skipped === 'undefined' || d.u_skipped === '') ? false : d.u_skipped,
                a_start_time: d.a_s_t == null ? null : d.a_s_t,
                a_end_time: (typeof d.a_e_t === 'undefined' || d.a_e_t === null) ? null : d.a_e_t,
                delay_start_time: (typeof d.d_s_t === 'undefined' || d.d_s_t === null || isNaN(d.d_s_t) || d.d_s_t === 0) ? null : parseInt(d.d_s_t),
                delay_end_time: (typeof d.d_e_t === 'undefined' || d.d_e_t === null || isNaN(d.d_e_t) || d.d_e_t === 0) ? null : parseInt(d.d_e_t),
                latitude: (typeof d.lat === 'undefined') || d.lat === null ? null : d.lat,
                longitude: (typeof d.lon === 'undefined') || d.lon === null ? null : d.lon,
                carrier_type: (typeof d.c_type === 'undefined' || d.c_type === '') ? null : d.c_type,
                created_at: new Date(),
                created_by: d.u_id ? null : d.u_id
            };
            //  let commonTask = {}
            //  commonTask.body = d
            //  mqttPublish(commonTask, mqtt.MQTT_TOPIC_NAME.TASK_COMPLETE);
            if (data.length > 0) {
                commonfunctionupdate(d, res);
                update_query = null;
                update_query = pgp.helpers.update(y, cs) + ' WHERE resource_mapping_id = ' + d.res_id + ' and a_start_time is not null ';
                db.any(update_query, function (res) { })
                    .catch(function (err) {
                        console.log("update_query", err);
                    });
            } else {
                commonfunctionupdate(d, res);
                insert_query = pgp.helpers.insert(y, cs) + 'RETURNING ID as task_status_id,RESOURCE_MAPPING_ID';
                db.any(insert_query, function (res) { })
                    .catch(function (err) {
                        console.log("insert", err);
                    });
            }
            //  if (d.t_name == chockson) {
            //      let con = {}
            //      con.body = d
            //      util.updateAta(d.f_S_Id, d.a_s_t, function (status, msg) {
            //         mqttPublish(con, mqtt.MQTT_TOPIC_NAME.CHOCKS_ON);
            //      })
            //      .catch(function (err) {
            //          console.log("updateATA", err);
            //      });
            //  }
            //  else if (d.t_name == chocksoff) {
            //     let coff = {}  
            //     coff.body = d
            //      util.updateAtd(d.f_S_Id, d.a_s_t, function (status, msg) {
            //         mqttPublish(coff, mqtt.MQTT_TOPIC_NAME.CHOCKS_OFF);
            //     })
            //      .catch(function (err) {
            //          console.log("updateAtd", err);
            //      });
            //  }
        });
        callback(null, update_query);
    }, function (err) {
        if (err) {
            res.status(200)
                .json({
                    status: false,
                    errorMessage: err
                });
        } else {
            res.status(200)
                .json({
                    status: true,
                    successMessage: x
                });
        }
    });
}
function commonfunctionupdate(d, res) {
    var req = {};
    req.body = d;
    // var query = 'SELECT TASK_COMPLETED_COUNT as tc, station_airport_code as station, FLIGHT_TYPE FROM task_status_summary_by_flight_sched_id_v WHERE flight_schedules_id = ' + parseInt(req.body.f_S_Id);
    var query = "select aa.code as station, aa.flight_type, \
            count(aa.task_completed_flag) as tc from (select CASE WHEN b.a_end_time IS NOT NULL THEN 1 ELSE NULL::integer END AS task_completed_flag, \
            e.code, a.flight_type from flight_schedules a \
            LEFT JOIN task_schedule_details c ON a.task_schedule_id = c.task_schedule_id AND c.active= 'Y'\
            LEFT JOIN resource_mapping d on d.task_schedule_detail_id = c.id AND d.flight_schedules_id = a.id AND d.active= 'Y'\
            left join task_status b ON b.resource_mapping_id = d.id AND b.active= 'Y'\
            join airport_master e on e.id = a.station \
            where a.id in ($1)) \
            as aa group by aa.code, aa.flight_type";
    var isTaskStart = (typeof req.body.a_e_t != 'undefined' && (req.body.a_e_t === null || req.body.a_e_t === ''));
    var isTaskSkipped = req.body.u_skipped;
    if (!isTaskStart || isTaskSkipped) {
        db.any(query, [parseInt(req.body.f_S_Id)])
            .then(function (data) {
                req.body.flightType = data && data[0] ? data[0].flight_type : null;
                req.body.station = data && data[0] ? data[0].station : '';
                checkTerminatingComplete(req, res, function (err, data1) {
                    if (data1 && data1[0] && data1[0].completed) {
                        req.body.completed = true;
                        req.body.station = data && data[0] ? data[0].station : '';
                        updatePendingTasks(req, res);
                    } else {
                        req.body.completed = req.body.completed ? req.body.completed : false;
                    }
                    req.body.taskCompletedCount = data[0].tc;
                    mqttPublish(req, mqtt.MQTT_TOPIC_NAME.TASK_COMPLETE);
                    if (req.body.t_name == chockson) {
                        util.updateAta(req.body.f_S_Id, req.body.a_s_t, function (status, msg) {
                            mqttPublish(req, mqtt.MQTT_TOPIC_NAME.CHOCKS_ON);
                        });
                    } else if (req.body.t_name == chocksoff) {
                        util.updateAtd(req.body.f_S_Id, req.body.a_e_t, function (status, msg) {
                            mqttPublish(req, mqtt.MQTT_TOPIC_NAME.CHOCKS_OFF);
                        });
                    }
                });
            })
            .catch(function (err) {
                console.log("task_action ", err);
            });
    }
}
function bulkTaskAction(req, res, next) {
    console.log("bulkTaskAction", req.body);
    bulkTasks(req, res, next, function (status, message) {
    });
}
module.exports = {
    taskStart: taskStart,
    bulkTaskAction: bulkTaskAction
};
