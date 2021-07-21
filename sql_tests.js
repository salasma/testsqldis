var mysql = require('mysql');
var pool = mysql.createPool({
    connectionLimit : 10,
    host            : 'classmysql.engr.oregonstate.edu',
    user            : 'cs340_hagmana',
    password        : '1161',
    database        : 'cs340_hagmana'
});

module.exports.pool = pool;

var express = require('express');

var app = express();

var handlebars = require('express-handlebars');

var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.engine('handlebars', handlebars({defaultLayout: 'main', extname: '.handlebars'}));
app.set('view engine', 'handlebars');
app.set('port', 6976);

app.listen(app.get('port'), function(){
    console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.');
});

//returns the table of users, the diagnoses table is joined on sicknessID so that the name of the diagnosis is
//displayed rather than the numerical ID

app.get('/users', function(req, res){
    var callbackCount = 0;
    var context = {};
    //context.jsscripts = ["deleteperson.js"];
    var mysql = req.app.get('mysql');

    getUsers(res, mysql, context, complete);
    getStates(res, mysql, context, complete);
    getDiagnoses(res, mysql, context, complete);

    function complete(){
        callbackCount++;
        if(callbackCount >= 3){
            res.render('users', context);
        }

    }
});

//returns the table of states

app.get('/states', function(req, res){
    var callbackCount = 0;
    var context = {};

    var mysql = req.app.get('mysql');

    getStates(res, mysql, context, complete);
    function complete(){
        callbackCount++;
        if(callbackCount >= 1){
            res.render('states', context);
        }

    }
});

//returns the information of a single user based upon the given userID

app.get('/users/:userID', function(req, res){
    callbackCount = 0;

    var context = {};
    var mysql = req.app.get('mysql');

    getUser(res, mysql, context, req.params.userID, complete);

    function complete(){
        callbackCount++;
        if(callbackCount >= 1){
            res.render('user', context);
        }

    }
});

//returns the table of user-instances based upon a given userID. displays diagnosisName rather than the sicknessID

app.get('/instances/:userID', function(req, res){
    callbackCount = 0;

    var context = {};
    var mysql = req.app.get('mysql');

    getInstances(res, mysql, context, req.params.userID, complete);
    getDiagnoses(res, mysql, context, complete);

    function complete(){
        callbackCount++;
        if(callbackCount >= 2){
            res.render('instances', context);
        }

    }
});

//adds a user to the user table then refreshed / redirects to the user page to display the updated table

app.post('/users', function(req, res){
    var mysql = req.app.get('mysql');
    var sql = "INSERT INTO users (email, stateID, sicknessID) VALUES (?,?,?)";
    var inserts = [req.body.email, req.body.stateID, req.body.sicknessID];
    sql = pool.query(sql,inserts,function(error, results, fields){
        if(error){
            res.write(JSON.stringify(error));
            res.end();
        }else{
            res.redirect('/users');
        }
    });
});

//adds an instances to the instances table for a specific user

app.post('/instances/:userID', function(req, res){
    var mysql = req.app.get('mysql');
    var sql = "INSERT INTO instances (startDate, endDate, userID, sicknessID) VALUES (?,?,?,?)";
    var thisUser = req.params.userID;

    thisUser = thisUser.replace(":", "");    //removes the : so that SQL doesn't freak out when it tries to insert the userID

    var inserts = [req.body.startDate, req.body.endDate, thisUser, req.body.sicknessID];
    sql = pool.query(sql,inserts,function(error, results, fields){
        if(error){
            res.write(JSON.stringify(error));
            res.end();
        }else{
            var redirectString = '/instances/'+ thisUser;
            res.redirect(redirectString);
        }
    });
});

app.use(function(req, res){
    res.status(404);
    res.render('404');
});

app.use(function( err, req, res, next){
    console.error(err.stack);
    res.status(500);
    res.render('500');
});

//selects the whole table of users, joins diagnoses on sicknessID so that the diagnosis is displayed

function getUsers(res, mysql, context, complete){
    pool.query("SELECT userID, email, stateID, diagnosisName, diagnoses.sicknessID FROM diagnoses JOIN users ON diagnoses.sicknessID = users.sicknessID", function(error, results, fields){
        if(error){
            res.write(JSON.stringify(error));
            res.end();
        }
        context.users = results;
        complete();
    });
};

//selects the whole table of states

function getStates(res, mysql, context, complete){
    pool.query("SELECT stateID, statePop, percentageSick FROM states", function(error, results, fields){
        if(error){
            res.write(JSON.stringify(error));
            res.end();
        }
        context.states = results;
        complete();
    });
};

//selects a specific user

function getUser(res,mysql, context, userID, complete){
    var sql = "SELECT userID, email, stateID, diagnosisName FROM diagnoses JOIN users ON diagnoses.sicknessID = users.sicknessID WHERE userID = ?";
    var inserts = [userID];
    pool.query(sql, inserts, function(error, results, fields){
        if(error){
            res.write(JSON.stringify(error));
            res.end();
        }
        context.user = results[0];
        complete();
    });
};

//selects instances based upon a specific userID

function getInstances(res, mysql, context, userID, complete){
    var sql = "SELECT startDate, endDate, userID, sicknessID FROM instances WHERE userID = ?";
    var inserts = [userID];
    pool.query(sql, inserts, function(error, results, fields){
        if(error){
            res.write(JSON.stringify(error));
            res.end();
        }
        context.instances = results;
        complete();
    });
};

function getDiagnoses(res, mysql, context, complete){
    pool.query("SELECT sicknessID, diagnosisName FROM diagnoses", function(error, results, fields){
        if(error){
            res.write(JSON.stringify(error));
            res.end();
        }
        context.diagnoses = results;
        complete();
    });
};

//selects the data from the diagnoses table


/* ECR SECTION

7/20/2021
    - make sure that the pages (app.get('/')) come before the error handlers, otherwise they dont load
7/21/2021
    - removing the ':' from the userID parameter for inserting instances
        https://stackoverflow.com/questions/10398931/how-to-remove-text-from-a-string
    - insert still not working???
        - woah. inserting on the userID + 1? was testing insert on userID3, and nothing happened. but userID 4 now
        has new instances????
            - it's sorting by diagnoses, not userID
     - inserting was correct, select statement was incorrect. removed the join and currently only selecting from the
     instances table




 */