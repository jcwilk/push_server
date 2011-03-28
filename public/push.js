NodePush = function(){
    function pollerFactory(channel,callback,sequence){
        var url = host+'/m/'+channel+'.json?';
        if(sequence !== undefined) url+= 's='+sequence+'&';
        url+= 'callback=_jqjsp';
        $.jsonp({
            url: url,
            success: function(json){
                callback(json.data);
                pollerFactory(channel,callback,json.sequence);
            },
            error: function(){
                pollerFactory(channel,callback,sequence);
            }

        });
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

    var host = 'https://pushserver.duostack.net';
    function setHost(newHost){
        host = newHost
    }

    return {bind: binderFactory(),
            setHost: setHost}
}();