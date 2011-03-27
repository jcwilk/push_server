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

    function messagesSince(start){
        var mes = messages.slice(start+1);
//        logInspect(messages);
//        logInspect('------------------------------');
//        logInspect(mes);
        return mes;
    }

    function currentSequence(){
        return messages.length-1;
    }

    function processCallback(callback){
        if(callback.sequence == currentSequence()){
            callbacks.push(callback)
        } else {
            callback({data: messagesSince(callback.sequence),
                      sequence: currentSequence()})
        }
    }

    function read(sequence, callback){
        if(sequence === undefined || sequence > currentSequence()){
            callback.sequence = -1
        } else {
            callback.sequence = sequence
        }
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

    server.get(new RegExp("^/m/([^?]*).json$"),function(req,res,match){
        var query = url.parse(req.url,true).query;
        var lastMessage = query.s;
        if(lastMessage !== undefined) lastMessage = parseInt(lastMessage);
        var callback = query.callback;
        channelMan(match).read(lastMessage, function(data){
            res.simpleText(200,callback+'('+JSON.stringify(data)+')')
        })
    });

    server.post(new RegExp("^/m/([^?]*).json$"),function(req,res,match,data){
        channelMan(match).send(data);
        res.simpleJson(200,data);
    },'json');

    server.get('/push.js',function(req,res){
        paperboy.deliver(publicRoot,req,res)
    });

    server.listen(3000);
}
main();