var util = require('util'),
    inspect = util.inspect,
    logInspect = function(item){console.log(util.inspect(item))},
    url = require('url'),
    querystring = require('querystring'),
    fs = require('fs'),
    paperboy = require('./lib/paperboy'),
    path = require('path'),
    publicRoot = path.join(path.dirname(__filename), 'public');

//Returns a new channel
//A channel is basically just an indexed queue of json messages
//External clients will typically be syncing their history of messages with these channel queues
//Adding a message to a channel queue is synonymous with broadcasting that message to listeners of that channel
function channelFactory(){
    var callbacks = [];
    var messages = [];

    //get array of all the messages since +start+
    function messagesSince(start){
        return messages.slice(start+1);
    }

    //get the current sequence number of the head of the channel
    function currentSequence(){
        return messages.length-1;
    }

    //depending on the sequence number, queue the +callback+ for later or process it now
    function processCallback(callback){
        if(callback.sequence == currentSequence()){ //they're up to date, add them to the listeners pool to wait for new data
            callbacks.push(callback)
        } else { //they're out of date, run the callback right away and give it the data they're missing
            callback({data: messagesSince(callback.sequence),
                      sequence: currentSequence()})
        }
    }

    //handle a listener +callback+ synced to the channel up to +sequence+
    function read(sequence, callback){
        if(sequence === undefined || sequence > currentSequence()){ //the sequence is missing or screwed up, mark them as missing all data
            callback.sequence = -1
        } else { //assign the sequence to the callback
            callback.sequence = sequence
        }
        processCallback(callback)
    }

    //add +data+ to the channel and trigger all the listeners to be processed
    function send(data){
        messages.push(data);
        var callbacksToProcess = callbacks; //clone the listener queue
        callbacks = []; //reset the listener queue

        //go through each of the listeners and reprocess them,
        //potentially adding them back into the reset queue if there's nothing new
        while(callbacksToProcess.length > 0){
            var callback = callbacksToProcess.shift();
            processCallback(callback);
        }
    }
    
    return {read: read, send: send}
}

//Returns a channel manager
//A channel manager is a read-or-create associative array of channels
//The server should use one of these to keep track of the active channels
function channelManagerFactory(){
    var channels = {};

    return function(channelName){
        var c = channels[channelName];
        if(c) return c;

        return (channels[channelName] = channelFactory());
    }
}

function main(){
    var channelMan = channelManagerFactory(); //set up a channel manager

    var server = require('./lib/node-router').getServer(); //set up the http server

    //set up the long-poll channel serving GET action
    server.get(new RegExp("^/m/([^?]*).json$"),function(req,res,match){
        var query = url.parse(req.url,true).query;
        var lastMessage = query.s; //pull out the index that the listener is synced up to
        if(lastMessage !== undefined) lastMessage = parseInt(lastMessage);
        var callback = query.callback;
        channelMan(match).read(lastMessage, function(data){ //return the data when there's data since lastMessage index
            res.simpleText(200,callback+'('+JSON.stringify(data)+')')
        })
    });

    //post new data to a channel
    server.post(new RegExp("^/m/([^?]*).json$"),function(req,res,match,data){
        channelMan(match).send(data); //add the posted data to the channel
        res.simpleJson(200,data); //return the posted data as json for debugging reasons
    },'json');

    //get the client-side javascript file for abstracting the push server into a javascript object
    server.get('/push.js',function(req,res){
        paperboy.deliver(publicRoot,req,res)
    });

    //listen on 3000, this is ignored by the production servers
    server.listen(3000);
}
main();