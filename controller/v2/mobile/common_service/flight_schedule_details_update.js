
var db = require('../../../../dbConnection');
var moment = require('moment');
const pgp = require('pg-promise')({
    /* initialization options */
    capSQL: true // capitalize all generated SQL
});

function updatePendingTask(flight_schedule_id,atd,callback) {
    db.any('UPDATE TASK_STATUS SET A_END_TIME = $1 WHERE RESOURCE_MAPPING_ID IN \
    (SELECT ID FROM RESOURCE_MAPPING WHERE flight_schedules_id = $2) \
    AND A_END_TIME IS NULL AND A_START_TIME IS NOT NULL AND ACTIVE=\'Y\'',
     [atd, parseInt(flight_schedule_id)]).then(function (data) {
         callback(true,"Record updated Successfully")
        })
        .catch(function (err) {
            callback(false,err)
        })
}
function updateAta(flight_schedule_id, ata, callback) {
    console.log("******************************* update ata",ata)
    var a_t_a= moment(ata).unix() * 1000;
    var turnTime;
    var q='SELECT EXTRACT(EPOCH FROM fs.standard_arrival_time)*1000 as standard_arrival_time,\
    EXTRACT(EPOCH FROM fs.standard_departure_time)*1000 as standard_departure_time\
   FROM FLIGHT_SCHEDULES as fs WHERE id='+flight_schedule_id;
    db.any(q).then(function(datas){
        console.log(datas,ata,"select update ata dataaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        for(var ind=0;ind<datas.length;ind++){
            turnTime=a_t_a+(datas[ind].standard_departure_time-datas[ind].standard_arrival_time);
            console.log(parseInt(turnTime),"tttttttttttttttttttttttttttttt")
        }
        var query = 'UPDATE FLIGHT_SCHEDULES SET ACTUAL_ARRIVAL_TIME =$1,TURN_TIME = TO_TIMESTAMP($2/1000) WHERE ID = $3';
        db.any(query, [ata,turnTime, parseInt(flight_schedule_id)])
            .then(function (data) {
                console.log(data,"turn time updating in fs")
                callback(true, "Record updated Successfully")
            })
            .catch(function (err) {
                console.log(err,"errrrrrrrrrrrrrrrrrrr")
                callback(false, err)
            });
    })
   
}
function updateAtd(flight_schedule_id, atd, callback) {
    var query = 'UPDATE FLIGHT_SCHEDULES SET ACTUAL_DEPARTURE_TIME = $1 WHERE ID = $2 returning ESTIMATED_ARRIVAL_TIME,ESTIMATED_DEPARTURE_TIME,STATION';
    db.one(query, [atd, parseInt(flight_schedule_id)])
        .then(function (data) {
            updatePendingTask(flight_schedule_id,atd,function(status,msg){
                if(status)
                callback(status,msg)
                else callback(status,msg)
            })

        })
        .catch(function (err) {
            callback(false,err)
        });
}
module.exports = {
    updateAta: updateAta,
    updateAtd: updateAtd
};
