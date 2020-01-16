/*
Created on : 24-05-2019
1. Get the tasks assigned to user by flight
2. Get the shift details of the user
3. Group all the tasks by flight
4. Calculate the required params
*/
var db = require('../../../../dbConnection');
var _ = require('underscore');
// var util = require('../util');
var query = require('../utils/query');
var moment = require('moment');
/*
Old one */
/*
function getReportByUser(req, res, next) {
    // var paramExists = (typeof req.query.id != 'undefined' && req.query.timezone != '') ? true : false;     
            var zone = req.query.timezone;    
            var sod = moment.tz(zone).startOf('day').format('YYYY-MM-DDTHH24:MI:SS').toString();
            var eod = moment.tz(zone).endOf('day').format('YYYY-MM-DDTHH24:MI:SS').toString();
            var currDate = moment.tz(zone).utc().format('YYYY-MM-DD').toString();
            var ontime_task= 0,
                task_performed= 0,
                departed_flight= 0,
                skipped_task= 0,
                delayed_task= 0,
                task_assigned_task = 0,
                total_flight = 0,
                shift_name = "-",start_time="-",end_time="-";
                console.log(zone , sod , eod);
    if (zone && sod && eod) {
        console.log('inside the if loop')
        db.query(query.shift_query, [req.query.id,zone, sod , eod]).then(function (data) {
            console.log(data);
            shift_name = data[0] ? data[0].shift_name : '-';
            start_time = data[0] ? data[0].start_time : '-';
            end_time = data[0] ? data[0].end_time : '-';
            db.query(query.my_report_get_query, [req.query.id, zone, currDate]).then(function (fltData) {
                var flight= [];
                var task=[];
                var taskSkipped= [];
                var taskPerformed= [];
                var ontimeTask  = 0;
                var delayedTask = 0;
                for (let index = 0; index < fltData.length; index++) {
                    const element = fltData[index];
                    flight.push({ id: element.flightSchedulesId, obj: element})
                    task.push({task_id: element.taskId})
                    if(element.taskSkipped){
                        taskSkipped.push(element);
                    }
                    if(element.taskActualEndTime){
                        taskPerformed.push(element);
                        var calc = element.delayEndTime ? delayedTask++ : ontimeTask ++; 
                    }
                }
                var flight = _.uniq(flight, function (x) {
                    return x.id;
                });
                var departedFlt = flight.filter(
                    count => count.obj.actualDepartureTime != null
                )
                var over_all_flights = (departedFlt.length / flight.length) * 100;
                var e = (ontimeTask / taskPerformed.length) * 100
                var eff = (isNaN(e)) ? 0 : e;
                // new set of functions end
                // var endTime = util.getTime();
                // var difference = util.getDifference(endTime,startTime);
                res.status(200)
                    .json({
                        status: true,
                        to_f: flight.length ? flight.length : 0, // total flights
                        t_a: task.length ? task.length: 0, // task assigned
                        t_s : taskSkipped.length ? taskSkipped.length: 0, // task skipped
                        d_f : departedFlt.length ? departedFlt.length: 0, // departed flight
                        t_p : taskPerformed.length ? taskPerformed.length:0, // task performed
                        t_ot : ontimeTask ? ontimeTask : 0, // ontime tasks
                        t_de: delayedTask ? delayedTask : 0, // delayed tasks
                        de_shift :{
                            sh_n : shift_name ? shift_name : '-', // shift name
                            s_t :start_time ? start_time : '-', // shift start time
                            e_t: end_time ? end_time: '-' // shift end time
                        },
                        o_f: over_all_flights ? over_all_flights: 0,       // overall flights                 
                        // executionTime : difference,
                        eff: eff ? eff : 0,                        // efficency
                        // successMessage: 'success', 
                        // responce : fltData
                    });
            })
            .catch(function (err) {
                res.status(200)
                    .json({
                        status: false,
                        errorMessage: err.message,
                        section: 'inner query'
                    });
            });

        })
            .catch(function (err) {
                res.status(200)
                    .json({
                        status: false,
                        errorMessage: err.message,
                        section: 'outer query'
                    });
            });
            }
    else {
        res.status(200)
            .json({
                status: false,
                errorMessage: 'Some Params are missing.. Please check.'
            });
    }

}
*/
function getReportByUser(req, res, next) {
    var paramExists =
        ((typeof req.query.id != 'undefined' && req.query.timezone != '') &&
            (typeof req.query.timezone != 'undefined')) ? true : false;
    if (paramExists) {
	 var zone = req.query.timezone;    
            var sod = moment.tz(zone).startOf('day').unix()*1000;//format('YYYY-MM-DDTHH24:MI:SS').toString();
            var eod = moment.tz(zone).endOf('day').unix()*1000;//format('YYYY-MM-DDTHH24:MI:SS').toString();
        var task_assigned_task = 0;
        var total_flight = 0,
            departed_flight = 0;
        var task_performed = 0,
            skipped_task = 0,
            ontime_task = 0,
            delayed_task = 0;
        var shift_name = "-",start_time="-",end_time="-";
        var q = 'SELECT \
        fs.id as "flight_schedules_id",\
        EXTRACT(EPOCH FROM ts.a_start_time)*1000 as a_start_time,\
        EXTRACT(EPOCH FROM ts.a_end_time)*1000 as a_end_time, \
        ts.delay_start_time as delay_start_time ,\
        ts.delay_end_time as delay_end_time,\
        EXTRACT(EPOCH FROM fs.actual_arrival_time)*1000  as actual_arrival_time , \
        EXTRACT(EPOCH FROM fs.actual_departure_time)*1000 as actual_departure_time,\
        ts.skipped as "task_skipped" \
        from resource_mapping as rm \
        LEFT JOIN flight_schedules as fs on fs.id = rm.flight_schedules_id \
        LEFT JOIN task_status as ts on rm.id=ts.resource_mapping_id \
        WHERE rm.user_id = $1 and \
        (\
            (actual_arrival_time is not null AND extract( epoch from actual_arrival_time)*1000 between $2 and $3)\
            OR\
            (estimated_arrival_time is not null AND extract( epoch from estimated_arrival_time)*1000 between $2 and $3)\
            OR\
            (standard_arrival_time is not null AND extract(epoch from standard_arrival_time)*1000 between $2 and $3 )\
            OR\
             (actual_departure_time is not null AND extract( epoch from actual_departure_time)*1000 between $2 and $3)\
            OR\
            (estimated_departure_time is not null AND extract( epoch from estimated_departure_time)*1000 between $2 and $3)\
            OR\
            (standard_departure_time is not null AND extract(epoch from standard_departure_time)*1000 between $2 and $3 )\
        );';       
        var shift_query = 'SET SESSION timezone TO $4; select sm.name as shift_name,\
        to_char(sm.start_time ::timestamp at time zone $4 , \'YYYY-MM-DD"T"HH24:MI:SS""\') as start_time ,\
        to_char(sm.end_time ::timestamp at time zone $4 , \'YYYY-MM-DD"T"HH24:MI:SS""\') as end_time \
         from user_shifts as us join shift_master sm on sm.id = us.shift_id\
             where us.user_id = $1 and extract(epoch from us.start_time)*1000 between $2 and $3 ';
        db.query(shift_query, [req.query.id, sod, eod, req.query.timezone]).then(function (data) {
            shift_name = data[0].shift_name;
            start_time = data[0].start_time;
            end_time =data[0].end_time;
            db.query(q, [req.query.id, sod, eod]).then(function (data) {
                var result = _.chain(data).groupBy('flight_schedules_id');
                task_assigned_task = data.length;
                var group_by_flight = _.groupBy(data, "flight_schedules_id");
                var flight_by_grouped = Object.values(group_by_flight);

                total_flight = flight_by_grouped.length;
                /* departed flight cal */
                _.each(flight_by_grouped, function (f_obj) {
                    if (f_obj[0].actual_departure_time != null) {
                        departed_flight++;
                    }
                })
                for (var i = 0; i < data.length; i++) {
                    var skip = data[i].task_skipped == true ? skipped_task++ : null;
                    if (data[i].a_end_time != null) {
                        task_performed = task_performed + 1;
                        /* skipped task count */
                        var ontime = data[i].delay_end_time == null ? ontime_task++ : delayed_task++;
                    }
                }
                var e = (ontime_task / task_performed) * 100
                efficiency = (isNaN(e)) ? 0 : e;
                var over_all_flights = (departed_flight / total_flight) * 100;
                res.status(200)
                    .json({
                        status: true,
                        t_p: task_performed,
                        t_a: task_assigned_task,
                        to_f: total_flight,
                        d_f: departed_flight,
                        t_s: skipped_task,
                        t_ot: ontime_task,
                        t_de: delayed_task,
                        eff: efficiency != null ? Number(efficiency.toFixed(2)) : 0,
                        o_f: over_all_flights != null ? Number(over_all_flights.toFixed(2)) : 0,
                        de_shift :{
                            sh_n : shift_name,
                            s_t :start_time,
                            e_t:end_time
                        },
                        successMessage: 'success'
                    });
            })
            .catch(function (err) {
                res.status(200)
                    .json({
                        status: false,
                        errorMessage: err.message
                    });
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
    else {
        res.status(200)
            .json({
                status: false,
                errorMessage: 'Some Params are missing.. Please check.'
            });
    }

}
module.exports = {
    getReportByUser: getReportByUser
}
