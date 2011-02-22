NodePush = function(){
    //http://javascriptweblog.wordpress.com/2010/11/29/json-and-jsonp/
    //USAGE:
    //var obamaTweets = "http://www.twitter.com/status/user_timeline/BARACKOBAMA.json?count=5&callback=JSONPCallback";
    //jsonp.fetch(obamaTweets, function(data) {console.log(data[0].text)});
    var jsonp = {
        callbackCounter: 0,

        fetch: function(url, callback) {
            var fn = 'JSONPCallback_' + this.callbackCounter++;
            window[fn] = this.evalJSONP(callback);
            url = url.replace('=JSONPCallback', '=' + fn);

            var scriptTag = document.createElement('SCRIPT');
            scriptTag.src = url;
            document.getElementsByTagName('HEAD')[0].appendChild(scriptTag);
        },

        evalJSONP: function(callback) {
            return function(data) {
                var validJSON = false;
                if (typeof data == "string") {
                    try {validJSON = JSON.parse(data);} catch (e) {
                        //console.warn('unable to parse: '+data)
                    }
                } else {
                    validJSON = JSON.parse(JSON.stringify(data))
                }
                if (validJSON) {
                    callback(validJSON);
                } else {
                    throw("JSONP call returned invalid or empty JSON");
                }
            }
        }
    };

    function pollerFactory(channel,callback,sequence){
        var url = 'http://'+host+'/m/'+channel+'.json?';
        if(sequence !== undefined) url+= 's='+sequence+'&';
        url+= 'callback=JSONPCallback';
        jsonp.fetch(url,function(json){
            //console.log('returning from '+channel+' with: '+JSON.stringify(json));
            pollerFactory(channel,callback,json.sequence);
            callback(json.data);
        })
    }

    function pollerManagerFactory(){
        var pollers = [];

        return {poll: function(channel,callback){
            pollers.push(pollerFactory(channel, callback))
        }}
    }

    function binderFactory(){
        var pollerMan = pollerManagerFactory();
        return function(channel,callback){
            pollerMan.poll(channel,callback)
        }
    }

    var host = 'pushserver.duostack.net';
    function setHost(newHost){
        host = newHost
    }

    return {bind: binderFactory(),
            setHost: setHost}
}();