var express = require('express');
var router = express.Router();
var mqtt = require('mqtt');
var config = require('config');
var mqttConfig = config.get('configVariables.mqtt');

var connectOpts = {
  username: mqttConfig.username,
  password: mqttConfig.password,
  port: mqttConfig.port,
  host: mqttConfig.host,
  rejectUnauthorized :  mqttConfig.rejectUnauthorized,
  clientId: mqttConfig.clientId+ new Date().getTime(),
  clean: mqttConfig.clean
};

global.client  = mqtt.connect(connectOpts);

// var delayTaskMap= require('../controller/v2/mobile/delay_task_mapping/delay_task_mapping');
   var mobileV2_login = require('../controller/v2/mobile/login/login')
   var mobileV2_getTask= require('../controller/v2/mobile/tasks/get_task_by_user');
   var mobile_task_action = require('../controller/v2/mobile/tasks/task_action');
   var mobileV2_reAssign = require('../controller/v2/mobile/reassign/reassign');
   var mobileV2_pushAccept = require('../controller/v2/mobile/reassign/acceptTask');
   var mobile_report = require('../controller/v2/mobile/reports/my_report');
   var mobile_task_completed = require('../controller/v2/mobile/tasks/task_completed_list');


/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

// /* V2 */
// router.get('/getDelayTaskMap',delayTaskMap.getDelayTaskMapping);
router.get('/getReportByUser',mobile_report.getReportByUser);
router.get('/completedList',mobile_task_completed.getTaskCompletedListByUserId);
// router.get('/mobile/getDelayTaskMap',delayTaskMap.getDelayTaskMapping);

router.post('/mobile/login',mobileV2_login.login);
router.post('/mobile/logout',mobileV2_login.logout);
router.get('/mobile/getTaskByUserId',mobileV2_getTask.getTaskByUserId);
router.post('/mobile/task_action',mobile_task_action.taskStart);
router.post('/mobile/reAssign',mobileV2_reAssign.reAssign);
router.post('/mobile/bulkTaskAction',mobile_task_action.bulkTaskAction);
router.post('/mobile/pushAccept',mobileV2_pushAccept.pushReassignAccept)


module.exports = router;
