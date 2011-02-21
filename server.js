var util = require('util'),
    inspect = util.inspect,
    logInspect = function(item){console.log(util.inspect(item))},
    url = require('url'),
    querystring = require('querystring'),
    fs = require('fs'),
    paperboy = require('./lib/paperboy'),
    path = require('path'),
    publicRoot = path.join(path.dirname(__filename), 'public');

function channelFactory(){
    var callbacks = [];
    var messages = [];

    function textSince(start){
        return messages.slice(start+1);
    }

    function processCallback(callback){
        if(callback.lastMessage+1 >= messages.length){
            callbacks.push(callback)
        } else {
            callback(textSince(callback.lastMessage))
        }
    }

    function read(sequence, callback){
        callback.lastMessage = sequence;
        processCallback(callback);
    }

    function send(data){
        messages.push(data);
        var callbacksToProcess = callbacks;
        callbacks = [];
        while(callbacksToProcess.length > 0){
            var callback = callbacksToProcess.shift();
            processCallback(callback);
        }
    }
    
    return {read: read, send: send}
}

function channelManagerFactory(){
    var channels = {};

    return function(channelName){
        var c = channels[channelName];
        if(c) return c;

        return (channels[channelName] = channelFactory());
    }
}

function main(){
    var channelMan = channelManagerFactory();

    var server = require('./lib/node-router').getServer();

    server.get(new RegExp("^/m/([^?]*)$"),function(req,res,match){
        var lastMessage = parseInt(url.parse(req.url,true).query.s || '-1');
        logInspect(url.parse(req.url,true));
        channelMan(match).read(lastMessage, function(data){
            res.simpleText(200,JSON.stringify(data));
        })
    });

    server.post(new RegExp("^/m/([^?]*)$"),function(req,res,match,data){
        channelMan(match).send(data);
        res.simpleJson(200,data);
    },'json');

    server.get('/push.js',function(req,res){
        paperboy.deliver(publicRoot,req,res)
    });

    server.listen(3000);
}
main();