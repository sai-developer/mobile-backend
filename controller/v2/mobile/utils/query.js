var query = {};
query.login = 'select * from login($1,$2)';
// query.login ='SELECT \
// a.id  as id,\
// a.first_name f_name,\
// a.last_name l_name,\
// rm.name as role,\
// am.code as iata,\
// am.station_timezone as zone \
// FROM user_master a \
// INNER JOIN user_role_mapping as r on r.user_id = a.id \
// INNER JOIN role_master as rm on rm.id= r.role_id \
// INNER JOIN user_airport_mapping as uam  on uam.user_id= a.id \
// INNER JOIN airport_master as am on am.id = uam.airport_id \
// WHERE a.user_id = $1 AND a.secret is NOT NULL AND a.secret = crypt($2,a.secret)';
query.update_lat_lng = 'update user_master set last_seen =NOW(), latitude =cast($1 as numeric), longitude =cast ($2 as numeric)  where user_id = $3';
query.check_urban_channel_id = 'SELECT * from device_log where user_id = $1';
query.insert_urban_push_id = "insert into device_log (date,user_id,token,device_type, active,created_by,created_at,modified_by,modified_at)\
 values (now(),$1,$2,$3,'Y',$1,now(),$1,now()) RETURNING id";
//query.getTaskByUserId = 'select * from rt_fn_get_task_by_user_id(520,\'Asia/Kolkata\');';//'select * from getTaskByUser(\'Asia/Kolkata\') as task_list'
query.getFuelReason = 'select * from getFuelReasonMaster()';
query.gettaskDelayCodeMapping= 'select * from getTaskDelayCodeMapping()';
query.getTaskByUserId = 'SET SESSION timezone TO $2;  SELECT \
fs.id as f_id,\
COALESCE(fs.arr_flight_number,fs.arr_flight_number,\'--\') as a_f_no,\
COALESCE(fs.dep_flight_number,fs.dep_flight_number,\'--\') as d_f_no,\
to_char(fs.standard_arrival_time ::timestamp at time zone $2 , \'YYYY-MM-DD"T"HH24:MI:SS""\')as sta,\
to_char(fs.standard_departure_time ::timestamp at time zone $2 , \'YYYY-MM-DD"T"HH24:MI:SS""\')as std,\
to_char(fs.estimated_arrival_time ::timestamp at time zone $2 , \'YYYY-MM-DD"T"HH24:MI:SS""\')as eta,\
to_char(fs.estimated_departure_time ::timestamp at time zone $2 , \'YYYY-MM-DD"T"HH24:MI:SS""\')as etd,\
to_char(fs.actual_arrival_time ::timestamp at time zone $2 , \'YYYY-MM-DD"T"HH24:MI:SS""\')as ata,\
to_char(fs.actual_departure_time ::timestamp at time zone $2 , \'YYYY-MM-DD"T"HH24:MI:SS""\')as atd,\
fs.ata_web as ata_web,\
fs.atd_web as atd_web,\
fs.flight_type as f_type,\
bm.bay_code as bay_code ,\
json_agg(json_build_object(\'r_id\',rm.id,\'id\',tsd.task_id,\'n\',regexp_replace(tm.name, E\'[\\n\\r]+\', \' \', \'g\' ),\'d\',tsd.duration,\'i_d_c\',tm.is_depend_chockson,\'s\',tsd.optional,\'t_seq\',tsd.task_sequence_number,\'a_d_t\',tsd.arr_dep_type,\'a_st\',tsd.activity_start,\
\'t_ata\',to_char (ts.a_start_time::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\'),\
\'t_atd\',to_char (ts.a_end_time::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\'),\
\'d_i\',ts.delay_code_id,\'u_s\',ts.skipped,\'p_by\',ts.performed_by)) as task_details \
from resource_mapping as rm \
INNER JOIN flight_schedules as fs on fs.id = rm.flight_schedules_id  AND rm.active::text = \'Y\'::text \
INNER JOIN task_schedule_details as tsd on rm.task_schedule_detail_id = tsd.id AND rm.active::text = \'Y\'::text \
INNER JOIN task_master as tm on tm.id= tsd.task_id AND tm.active::text = \'Y\'::text \
LEFT JOIN bay_master as bm on bm.id =fs.bay_id   \
LEFT JOIN task_status as ts on rm.id=ts.resource_mapping_id \
WHERE rm.user_id = $1  AND \
(fs.standard_departure_time >= (\'now\'::text::date) OR fs.standard_arrival_time >= (\'now\'::text::date)) \
GROUP BY fs.id,bm.bay_code order by fs.standard_arrival_time DESC ;';

query.task_action_insert_query = 'INSERT INTO TASK_STATUS (\
    RESOURCE_MAPPING_ID,\
    DELAY_REASON,\
    ACTIVE,\
    DELAY_CODE_ID,\
    SKIPPED,\
    CREATED_BY,\
    CREATED_AT,\
    a_start_time,\
    a_end_time,\
    e_start_time,\
    e_end_time,\
    delay_start_time,\
    delay_end_time,\
    performed_by,\
    device_details,\
    latitude,\
    longitude) \
        VALUES(\
            $1,\
            $2,\
            \'Y\',\
            $3,\
            $4,\
            $5,\
            NOW(),\
            $6,\
            $7,\
            $8,\
           $9,\
            $10,\
            $11,\
            $12,\
            $13,\
            $14,\
            $15) \
    RETURNING ID as task_status_id,RESOURCE_MAPPING_ID';

query.task_action_update_query = 'UPDATE TASK_STATUS SET \
    RESOURCE_MAPPING_ID=COALESCE($1,RESOURCE_MAPPING_ID),\
    DELAY_REASON=$2,\
    ACTIVE=\'Y\',\
    DELAY_CODE_ID=$3,\
    SKIPPED=$4,\
    MODIFIED_BY=$5,\
    MODIFIED_AT=NOW(),\
    a_start_time=$6,\
    a_end_time=$7,\
    e_start_time=$8,\
    e_end_time=$9,\
    delay_start_time=$10,\
    delay_end_time=$11,\
    performed_by=$12,\
    device_details=$13,\
    latitude=$14,\
    longitude=$15 \
    WHERE RESOURCE_MAPPING_ID=$1 and A_START_TIME is not null RETURNING ID as task_status_id,RESOURCE_MAPPING_ID';

// get query for my reports
query.my_report_get_query = 'SET SESSION timezone TO $2; select\
        flight_schedules_id "flightSchedulesId",\
        to_char (flight_schedules_date::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\') as flightSchedulesDate ,\
        arr_flight_number "arrFlightNumber", dep_flight_number "depFlightNumber",\
        flight_type "flightType", user_id "userId", \
        resource_mapping_id "resourceMappingId",name "name", \
        task_schedule_detail_id "taskScheduleDetailId", task_id "taskId",\
        task_name "taskName", task_duration "taskDuration",\
        task_sequence_number "taskSequenceNumber",arrival_departure_type "taskArrivalDepartureType",\
        activity_start_time "taskStartTimeforArrDepType", optional "optional",\
        task_status_id "taskStatusId", \
        delay_start_time "delayStartTime", delay_end_time "delayEndTime",\
        to_char (task_actual_start_time::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\') "taskActualStartTime", \
        to_char (task_actual_end_time::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\') "taskActualEndTime", \
        to_char (task_modified_start_time::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\') "taskModifiedStartTime", \
        to_char (task_modified_end_time::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\') "taskModifiedEndTime", \
        to_char (e_start_time::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\') "task_planned_start_time", \
        to_char (e_end_time::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\') "task_planned_end_time", \
        to_char (actual_arrival_time::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\') "actualArrivalTime", \
        to_char (actual_departure_time::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\') "actualDepartureTime", \
        task_skipped "taskSkipped" from task_sched_res_mapping_mobile_v\
        WHERE USER_ID in ($1) AND\
        to_char (flight_schedules_date::timestamp at time zone $2, \'YYYY-MM-DD\') = $3'

// get query user shift
query.shift_query = 'SET SESSION timezone TO $2; select sm.name as shift_name,\
to_char (sm.start_time::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\') as start_time ,\
to_char (sm.end_time::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\') as end_time\
 from user_shifts as us join shift_master sm on sm.id = us.shift_id\
     where us.user_id = $1 and to_char (us.start_time::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\') between $3 and $4 ';
     
//get query for task completed list
query.task_completed_list = 'SET SESSION timezone TO $2;  SELECT \
fs.id as f_id,\
COALESCE(fs.arr_flight_number,fs.arr_flight_number,\'--\') as a_f_no,\
COALESCE(fs.dep_flight_number,fs.dep_flight_number,\'--\') as d_f_no,\
to_char(fs.standard_arrival_time ::timestamp at time zone $2 , \'YYYY-MM-DD"T"HH24:MI:SS""\')as sta,\
to_char(fs.standard_departure_time ::timestamp at time zone $2 , \'YYYY-MM-DD"T"HH24:MI:SS""\')as std,\
to_char(fs.estimated_arrival_time ::timestamp at time zone $2 , \'YYYY-MM-DD"T"HH24:MI:SS""\')as eta,\
to_char(fs.estimated_departure_time ::timestamp at time zone $2 , \'YYYY-MM-DD"T"HH24:MI:SS""\')as etd,\
to_char(fs.actual_arrival_time ::timestamp at time zone $2 , \'YYYY-MM-DD"T"HH24:MI:SS""\')as ata,\
to_char(fs.actual_departure_time ::timestamp at time zone $2 , \'YYYY-MM-DD"T"HH24:MI:SS""\')as atd,\
fs.flight_type as f_type,\
bm.bay_code as bay_code ,\
json_agg(json_build_object(\'r_id\',rm.id,\'id\',tsd.task_id,\'n\',regexp_replace(tm.name, E\'[\\n\\r]+\', \' \', \'g\' ),\'d\',tsd.duration,\'s\',tsd.optional,\
\'t_ata\',to_char (ts.a_start_time::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\'),\
\'t_atd\',to_char (ts.a_end_time::timestamp at time zone $2, \'YYYY-MM-DD"T"HH24:MI:SS""\'),\
\'u_s\',ts.skipped,\'p_by\',ts.performed_by)) as task \
from resource_mapping as rm \
INNER JOIN flight_schedules as fs on fs.id = rm.flight_schedules_id  AND rm.active::text = \'Y\'::text \
INNER JOIN task_schedule_details as tsd on rm.task_schedule_detail_id = tsd.id AND rm.active::text = \'Y\'::text \
INNER JOIN task_master as tm on tm.id= tsd.task_id AND tm.active::text = \'Y\'::text \
INNER JOIN bay_master as bm on bm.id =fs.bay_id   \
LEFT JOIN task_status as ts on rm.id=ts.resource_mapping_id \
WHERE rm.user_id = $1 AND date(fs.date) = $3 AND fs.actual_departure_time is not null \
GROUP BY fs.id,bm.bay_code order by fs.standard_arrival_time DESC ;'

var chockson = "Chocks on";
module.exports = query;
