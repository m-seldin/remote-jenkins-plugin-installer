'use strict';
const request = require('sync-request');
const log4js = require('log4js');
const express = require('express');
const fs = require("fs");
const bodyParser = require('body-parser');
const exec = require('sync-exec');
const app = express();
const configFile = '.configs/config.json';
const templateFile = './templates/octane-con-template.xml';

log4js.configure({
    appenders: [
        { type: 'console' },
        { type: 'file', filename: 'logs/server.log' }
    ]
});

const logger = log4js.getLogger();

if(!fs.existsSync(configFile)){
    logger.error(`configuration file does not exist! ${configFile}`);
}

if(!fs.existsSync(templateFile)){
    logger.error(`template file does not exist! ${templateFile}`);
}


let configuration = JSON.parse(fs.readFileSync(configFile));

const hpAAPluginDownloadBaseUrl = `http://repo.jenkins-ci.org/releases/org/jenkins-ci/plugins/hp-application-automation-tools-plugin/`;
const hpAAArtifactBaseName = `hp-application-automation-tools-plugin`;

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.post('/installPlugin', function (req, res) {
    logger.info(`Received params : `);
    logger.info(req.body);

    let params = req.body;
    let version = params.version;
    let fileName = `${hpAAArtifactBaseName}-${version}.hpi`;
    let urlToDownload = `${hpAAPluginDownloadBaseUrl}${version}/${fileName}`;
    let dest = `${configuration.jenkinsPluginsDir}/${fileName}`;
    let restartCommand = `java -jar ${configuration.jenkinsCli} -s http://localhost:${configuration.jenkinsPort}/ restart`;

    if(shouldReplaceVersion(version)) {
        logger.info(`Trying to download version ${version}`);
        logger.info(`Download url: ${urlToDownload}`);
        logger.info(`To: ${dest}`);

        exec(`rm -R ${configuration.jenkinsPluginsDir}/hp-application-automation-*`);
        exec(`curl -o ${dest} -O ${urlToDownload}`);
        logger.info(`Version downloaded successfully`);

        //writeConConfigFile(configuration.jenkinsPluginsDir,params);


        logger.info(`Restart command ${restartCommand}`);
        exec(restartCommand);
        //exec(`curl http://localhost:8080/restart`);

        logger.info(`Restarted jenkins`);
        res.end("RESTARTED");
    }else{
        logger.info(`No need to install new plugin, current version equals needed version ${version}`);
        res.end("OK");
    }

});

const server = app.listen(configuration.port, function () {

    let host = server.address().address
    let port = server.address().port

    logger.info("Example app listening at http://%s:%s", host, port)

});

function shouldReplaceVersion(neededVersion){
    let res = request('GET', `http://localhost:8080/pluginManager/api/json?depth=1`);
    let pluginsList = JSON.parse(res.getBody());

    for(let plugin of pluginsList.plugins){
        if(plugin.shortName =="hp-application-automation-tools-plugin"){
            if(plugin.version==neededVersion)
                return false;
        }
    }

    return true;

}

function writeConConfigFile(jenkinsLoc,params){
    const connSettings = params.connSettings;
    const oldNameSpace = `com.hp.application.automation.tools.settings.OctaneServerSettingsBuilder`;
    const newNameSpace = `com.hpe.application.automation.tools.settings.OctaneServerSettingsBuilder`;
    const newModel = `com.hpe.application.automation.tools.model.OctaneServerSettingsModel`;
    const oldModel = `com.hp.application.automation.tools.model.OctaneServerSettingsModel`;
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
    connTemplate = connTemplate.replace(/\$model\$/g,oldModel);


    let oldConfFileName =`${configuration.jenkinsDir}/${oldNameSpace}.xml`;
    let newConfFileName = `${configuration.jenkinsDir}/${newNameSpace}.xml`;
    logger.info(`Old format configuration : ${oldConfFileName}`);
    logger.info(`New format configuration : ${newConfFileName}`);



    if(!fs.existsSync(oldConfFileName) || !isServerNameInConfigFile(oldConfFileName,connSettings.location)) {
        logger.info(`Writing old configuration file ${oldConfFileName}`);
        fs.writeFileSync(oldConfFileName, connTemplate);
    }else{
        logger.info(`${oldConfFileName} configuration exists, not rewriting`);
    }
    let re = new RegExp(oldNameSpace,"g");
    connTemplate = connTemplate.replace(re,newNameSpace);
    re =new RegExp(oldModel,"g");
    connTemplate = connTemplate.replace(re,newModel);
    if(!fs.existsSync(newConfFileName) || !isServerNameInConfigFile(newConfFileName,connSettings.location)) {
        logger.info(`Writing new configuration file ${newConfFileName}`);
        fs.writeFileSync(newConfFileName, connTemplate);
    }else{
        logger.info(`${newConfFileName} configuration exists, not rewriting`);
    }

    logger.info(`Done writing configuration file`);
}

function isServerNameInConfigFile(currentConfig,requestedServer){
    let config = fs.readFileSync(currentConfig);
    if(config.indexOf(requestedServer)>=0){
        logger.info(`Server ${requestedServer} is in the current config file`);
        return true;
    }

    logger.info(`Server ${requestedServer} is NOT in the current config file`);
    return false;
}