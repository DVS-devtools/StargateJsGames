

(function(w){
    'use strict';

    function define_stargate(){

        // Public Stargate Object
        var s = {};

        // 
        var isRunningOnCordova = function () {
            return (typeof window["cordova"] !== "undefined");
        };
        var log = function(msg, obj) {
            if (typeof obj !== 'undefined') {
                console.log("[Stargate] "+msg+" ",obj);
            } else {
                console.log("[Stargate] "+msg);
            }
        };
        var err = function(msg, obj) {
            if (typeof obj !== 'undefined') {
                console.error("[Stargate] "+msg+" ",obj);
            } else {
                console.error("[Stargate] "+msg);
            }
        };
        var callPushNotificationCallback = function(data, type) {
            if (typeof w.stargate.callbacks.pushNotification !== 'function') {
                return err("stargate.callbacks.pushNotification not callable!");
            }
            if (typeof data !== 'object') {
                data = {"_empty":true};
            }
            data["_type"] = type;
            w.stargate.callbacks.pushNotification(data);
        };

        s.options = {};
        s.options.deltadnaEnabled = false;
        s.options.deltadnaEnviromentKey = '';
        s.options.deltadnaCollectHostName = '';
        s.options.deltadnaEngageHostName = '';
        s.options.deltadnaOnStartSendGameStartedEvent = true;
        s.options.deltadnaOnFirstRunSendNewPlayerEvent = true;
        s.options.gameEnabled = false;
        s.options.iapEnabled = false;
        s.options.iapAndroidLicenseKey = '';
        s.options.appsflyerEnabled = false;
        s.options.appsflyerDevkey = '';
        s.options.iosItunesAppId = '';
        s.options.heyzapEnabled = false;
        s.options.heyzapPublisherId = '';

        s.callbacks = {};
        s.callbacks.pushNotification = function(data) {err("pushNotification callback not defined")};

        var initDeltadna = function() {
            if (!w.stargate.options.deltadnaEnabled) {
                return;
            }
            if (!!!w.stargate.options.deltadnaEnviromentKey) {
                throw new Error("Delta dna enviromentKey undefined");
            }
            if (!!!w.stargate.options.deltadnaCollectHostName) {
                throw new Error("Delta dna collectHostName undefined"); 
            }
            if (!!!w.stargate.options.deltadnaEngageHostName) {
                throw new Error("Delta dna engageHostName undefined"); 
            }
            if (typeof w.deltadna == 'undefined') {
                throw new Error("Deltadna Undefined, missing cordova plugin ?");
            }
            var deltaDNAsettings = {
                "onStartSendGameStartedEvent":!!(w.stargate.options.deltadnaOnStartSendGameStartedEvent),
                "onFirstRunSendNewPlayerEvent":!!(w.stargate.options.deltadnaOnFirstRunSendNewPlayerEvent)  
            };

            w.deltadna.startSDK(
                w.stargate.options.deltadnaEnviromentKey,
                w.stargate.options.deltadnaCollectHostName,
                w.stargate.options.deltadnaEngageHostName, 
                function(result){log("[DeltaDNA] startSDK Ok ",result)}, 
                function(error){err("[DeltaDNA] startSDK ERROR ",error)}, 
                deltaDNAsettings
            );
                    
            w.deltadna.registerPushCallback(function(data){
                callPushNotificationCallback(data, "deltadna");
            });
        };

        s.init = function () {
            if (!isRunningOnCordova()) {
                return log("Not running on Cordova");
            }
            initDeltadna();
        };

        return s;
    }


    //define globally if it doesn't already exist
    if(typeof(stargate) === 'undefined'){
        w.stargate = define_stargate();
    }
    else{
        console.error("Stargate already defined.");
    }

})(window);


