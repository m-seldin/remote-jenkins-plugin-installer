'use strict';
const express = require('express');
const fs = require("fs");
const bodyParser = require('body-parser')
const exec = require('sync-exec');
const app = express();
const configFile = '.configs/config.json';
const templateFile = './templates/octane-con-template.xml';

if(!fs.existsSync(configFile)){
    console.log(`configuration file does not exist! ${configFile}`);
}

if(!fs.existsSync(templateFile)){
    console.log(`template file does not exist! ${templateFile}`);
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
    let restartCommand = `java -jar ${configuration.jenkinsCli} -s http://localhost:${configuration.jenkinsPort}/ restart`;

    console.log(`Trying to download version ${version}`);
    console.log(`Download url: ${urlToDownload}`);
    console.log(`To: ${dest}`);

    exec(`curl -o ${dest} -O ${urlToDownload}`);
    console.log(`Version downloaded successfully`);

    writeConConfigFile(configuration.jenkinsPluginsDir,params);


    console.log(`Restart command ${restartCommand}`);
    exec(restartCommand);
    //exec(`curl http://localhost:8080/restart`);

    console.log(`Restarted jenkins`);
    res.end("ok");
});

var server = app.listen(configuration.port, function () {

    var host = server.address().address
    var port = server.address().port

    console.log("Example app listening at http://%s:%s", host, port)

});

function writeConConfigFile(jenkinsLoc,params){
    const connSettings = params.connSettings;
    const oldNameSpace = `com.hp.application.automation.tools.settings.OctaneServerSettingsBuilder`;
    const newNameSpace = `com.hpe.application.automation.tools.settings.OctaneServerSettingsBuilder`;

    let connTemplate= fs.readFileSync(templateFile).toString();

    connTemplate = connTemplate.replace(/\$version\$/g,params.version);
    connTemplate = connTemplate.replace(/\$identity\$/g,connSettings.identity);
    connTemplate = connTemplate.replace(/\$identityFrom\$/g,connSettings.identityFrom);
    connTemplate = connTemplate.replace(/\$uiLocation\$/g,connSettings.uiLocation);
    connTemplate = connTemplate.replace(/\$username\$/g,connSettings.username);
    connTemplate = connTemplate.replace(/\$password\$/g,connSettings.password);
    connTemplate = connTemplate.replace(/\$location\$/g,connSettings.location);
    connTemplate = connTemplate.replace(/\$sharedSpace\$/g,connSettings.sharedSpace);
    connTemplate = connTemplate.replace(/\$namespace\$/g,oldNameSpace);


    let oldConfFileName =`${configuration.jenkinsDir}/${oldNameSpace}.xml`;
    let newConfFileName = `${configuration.jenkinsDir}/${newNameSpace}.xml`;
    console.log(`writing configuration to : ${oldConfFileName}`);
    console.log(`writing configuration to : ${newConfFileName}`);


    fs.writeFileSync(`${configuration.jenkinsDir}/${oldNameSpace}.xml`,connTemplate);
    var re = new RegExp(oldNameSpace,"g");
    connTemplate = connTemplate.replace(re,newNameSpace);
    fs.writeFileSync(`${configuration.jenkinsDir}/${newNameSpace}.xml`,connTemplate);

    console.log(`Done writing configuration file`);
}