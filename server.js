var   express = require('express')
    , http = require('http')
    , path = require('path');

var app = express();

app.set('title','OpenFin SnD');
// app.use(express.static(path.join(__dirname, 'src')));

/* serves main page  */
app.get('/', function (req, res) {
    console.log('GET root');
    res.sendFile("index.html", {"root": __dirname});
});

/* serves direct PDF */
app.get('/pdf-example-direct.pdf', function (req, res) {
    console.log('GET direct pdf');
    var fileName = req.originalUrl;
    res.sendFile(fileName, {
        "root": __dirname
    });
});

/* serves PDF as download */
app.get('/pdf-example-download.pdf', function (req, res) {
    console.log('GET download pdf');
    var fileName = req.originalUrl;
    res.download(path.join(__dirname, fileName), 'blah.pdf');
});

app.use(express.static(__dirname));

/* process.env.PORT is used in case you want to push to Heroku, for example, here the port will be dynamically allocated */
var port = process.env.PORT || 8888;

http.createServer(app).listen(port, function(){
    console.log('Express server listening on port ' + port);
});