'use strict';
const express = require('express');
const fs = require("fs");
const bodyParser = require('body-parser')
const exec = require('sync-exec');
const app = express();
const configFile = '.configs/config.json';

if(!fs.existsSync(configFile)){
    console.log(`configuration file does not exist! ${configFile}`);
}

let configuration = JSON.parse(fs.readFileSync(configFile));

const hpAAPluginDownloadBaseUrl = `http://repo.jenkins-ci.org/releases/org/jenkins-ci/plugins/hp-application-automation-tools-plugin/`;
const hpAAArtifactBaseName = `hp-application-automation-tools-plugin`;

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.post('/installPlugin', function (req, res) {
    console.log(`Received params : `);
    console.log(req.body);

    let params = req.body;
    let version = params.version;
    let fileName = `${hpAAArtifactBaseName}-${version}.hpi`;
    let urlToDownload = `${hpAAPluginDownloadBaseUrl}${version}/${fileName}`;
    let dest = `${configuration.jenkinsPluginsDir}/${fileName}`;

    console.log(`Trying to download version ${version}`);
    console.log(`Download url: ${urlToDownload}`);
    console.log(`To: ${dest}`);

    exec(`curl -o ${dest} -O ${urlToDownload}`);
    console.log(`Version downloaded successfully`);

    exec(`curl http://localhost:8080/reload`);

    res.end("ok");
});

var server = app.listen(configuration.port, function () {

    var host = server.address().address
    var port = server.address().port

    console.log("Example app listening at http://%s:%s", host, port)

});