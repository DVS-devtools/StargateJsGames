

(function(w){
    'use strict';

    function define_stargate(){

        /***
        * 
        * Stargate initialization steps:
        *  
        *  1)   set options in the 'stargate.options' and 
        *        callbacks in the 'stargate.calbacks' globals
        *
        *  2)   call stargate.init() method
        *
        *  3/a) load your game assets, then call stargate.hideSplashScreen(), 
        *        if you want to leave the application splashscreen when loading
        * 
        *  3/b) call stargate.hideSplashScreen() and show your loader GUI,
        *        if you want to show your loader to the user
        * 
        *  4)   call stargate.gameIsLoaded() when the loader if finished and user is in main menu
        * 
        */

        // Public Stargate Object
        var s = {};

        // logger function
        var log = function(msg, obj) {
            if (typeof obj !== 'undefined') {
                console.log("[Stargate] "+msg+" ",obj);
            } else {
                console.log("[Stargate] "+msg);
            }
            return true;
        };
        var err = function(msg, obj) {
            if (typeof obj !== 'undefined') {
                console.error("[Stargate] "+msg+" ",obj);
            } else {
                console.error("[Stargate] "+msg);
            }
            return false;
        };
        
        // device informations   // examples
        var runningDevice = {
            available: false,    // true
            cordova: "",         // 4.1.1
            manufacturer: "",    // samsung
            model: "",           // GT-I9505
            platform: "",        // Android
            uuid: "",            // ac7245e38e3dfecb
            version: ""          // 5.0.1
        };
        var isRunningOnAndroid = function() {
            return runningDevice.platform == "Android";
        };
        var isRunningOnIos = function() {
            return runningDevice.platform == "iOS";
        };
        var isRunningOnCordova = function () {
            return (typeof w.cordova !== "undefined");
        };

        // public stargate options to be set before init()
        s.options = {};
        s.options.deltadnaEnabled = false;
        s.options.deltadnaEnviromentKey = '';
        s.options.deltadnaCollectHostName = '';
        s.options.deltadnaEngageHostName = '';
        s.options.deltadnaOnStartSendGameStartedEvent = true;
        s.options.deltadnaOnFirstRunSendNewPlayerEvent = true;
        s.options.mixpanelEnabled = false;
        s.options.gameEnabled = false;
        s.options.iapEnabled = false;
        s.options.iapAndroidLicenseKey = '';
        s.options.appsflyerEnabled = false;
        s.options.appsflyerDevkey = '';
        s.options.iosItunesAppId = '';
        s.options.heyzapEnabled = false;
        s.options.heyzapPublisherId = '';
        s.options.cordovaHideStatusBar = true;

        // options are sealed after init(), we save them here, so inside stargate use this variable
        var savedOptions = {};

        // public stargate callbacks: 
        //  function that will be called when something on the application occurs
        //  to be set before init()
        s.callbacks = {};
        s.callbacks.pushNotification = function(data) {err("pushNotification callback not defined");};
        s.callbacks.androidBackButton = null;
        s.callbacks.engageSuccess = function(data) {err("engageSuccess callback not defined");};        
        s.callbacks.engageFailure = null;        

        //
        // call back handlers
        // 

        var stargatePushData = {};
        var isGameLoaded = false;

        var savePushNotificationData = function(data, type) {
            if (typeof data !== 'object') {
                data = {"_empty":true};
            }
            data["_type"] = type;
            stargatePushData = data;
        };
        var callPushNotificationCallback = function() {
            if (typeof w.stargate.callbacks.pushNotification !== 'function') {
                return err("stargate.callbacks.pushNotification not callable!");
            }
            
            if (isGameLoaded) {
                w.stargate.callbacks.pushNotification(stargatePushData);
                stargatePushData = {};
            }
        };
        var callAndroidBackButtonCallback = function(e) {
            if (typeof w.stargate.callbacks.androidBackButton !== 'function') {
                e.preventDefault();
                return err("stargate.callbacks.androidBackButton not callable!");
            }
            var exitApp = w.stargate.callbacks.androidBackButton();
            if (exitApp) {
                e.preventDefault();
                navigator.app.exitApp();
            }
            return true;
        };
        var callEngageSuccessCallback = function(decisionPoint, response) {
            if (typeof w.stargate.callbacks.engageSuccess !== 'function') {
                return err("stargate.callbacks.engageSuccess not callable!");
            }
            if (typeof response !== 'object') {
                response = {"_empty":true};
            }
            
            w.stargate.callbacks.engageSuccess(decisionPoint, response);
        };
        var callEngageFailureCallback = function(errorResponse) {
            if (typeof w.stargate.callbacks.engageFailure === 'function') {
                w.stargate.callbacks.engageFailure(errorResponse);
            }
        };

        var initDevice = function() {
            if (typeof w.device === 'undefined') {
                return err("Missing cordova device plugin");
            }
            for (var key in runningDevice) {
                if (w.device.hasOwnProperty(key)) {
                    runningDevice[key] = w.device[key];
                }
            }
            return true;
        };

        var initCordova = function() {
            
            if (savedOptions.cordovaHideStatusBar) {
                if (typeof w.StatusBar === 'undefined') {
                    err("Missing cordova statusbar plugin");
                } else {
                    log("[Cordova] Hiding statusbar");
                    w.StatusBar.hide();
                }
            }
            
            if (typeof w.stargate.callbacks.androidBackButton === 'function') {
                document.addEventListener(
                    'backbutton',
                    function(e){
                        log("[Cordova] backbutton pressed");
                        callAndroidBackButtonCallback(e);
                    },
                    false
                );
            }

            // FIXME: add other event listner:
            //  https://cordova.apache.org/docs/en/4.0.0/cordova/events/events.html

            return true;
        };

        // -----------------------------
        //       ANALITICS START
        // -----------------------------
        var initDeltadna = function() {
            if (!savedOptions.deltadnaEnabled) {
                return;
            }
            if (!!!savedOptions.deltadnaEnviromentKey) {
                throw new Error("Delta dna enviromentKey undefined");
            }
            if (!!!savedOptions.deltadnaCollectHostName) {
                throw new Error("Delta dna collectHostName undefined"); 
            }
            if (!!!savedOptions.deltadnaEngageHostName) {
                throw new Error("Delta dna engageHostName undefined"); 
            }
            if (typeof w.deltadna == 'undefined') {
                throw new Error("Deltadna Undefined, missing cordova plugin ?");
            }
            var deltaDNAsettings = {
                "onStartSendGameStartedEvent":!!(savedOptions.deltadnaOnStartSendGameStartedEvent),
                "onFirstRunSendNewPlayerEvent":!!(savedOptions.deltadnaOnFirstRunSendNewPlayerEvent)  
            };

            w.deltadna.startSDK(
                savedOptions.deltadnaEnviromentKey,
                savedOptions.deltadnaCollectHostName,
                savedOptions.deltadnaEngageHostName, 
                function(result){log("[DeltaDNA] startSDK Ok ",result);}, 
                function(error){err("[DeltaDNA] startSDK ERROR ",error);}, 
                deltaDNAsettings
            );
                    
            w.deltadna.registerPushCallback(function(data){
                
                savePushNotificationData(data, "deltadna");
                callPushNotificationCallback();
            });
        };

        // analitics private varible
        var deltaEngageParams = {};
        var analiticsEventProperties = {};
        var analiticsTransactionProperties = {};

        s.analitics = {};
        s.analitics.addEventProperty = function(propertyName, propertyValue) {
            analiticsEventProperties[propertyName] = propertyValue;
        };
        s.analitics.trackEvent = function(eventName) {

            if(savedOptions.deltadnaEnabled){
                log("[analitics.trackEvent] Sending to DeltaDNA: " + eventName);

                if (isRunningOnCordova()) {
                    //we sanitize JSON on native side
                    w.deltadna.recordEvent(
                        eventName,
                        analiticsEventProperties,
                        function(result){log("[DeltaDNA] recordEvent Ok ",result);}, 
                        function(error){err("[DeltaDNA] recordEvent ERROR ",error);}
                    );
                }
            }

            if(savedOptions.mixpanelEnabled){
                log("[analitics.trackEvent] Sending to Mixpanel: " + eventName);

                if (isRunningOnCordova()) {
                    w.mixpanel.track(
                        eventName,
                        analiticsEventProperties,
                        function(result){log("[Mixpanel] track Ok ",result);}, 
                        function(error){err("[Mixpanel] track ERROR ",error);}
                    );
                } else {
                    w.mixpanel.track(eventName, analiticsEventProperties);
                }
            }
            // clear already sent event properties
            analiticsEventProperties = {};
        };
        s.analitics.addEngagementParam = function(paramName, paramValue) {
            deltaEngageParams[paramName] = paramValue;
        };
        s.analitics.requestEngagement = function(decisionPoint) {

            var obj = {"decisionPoint":decisionPoint, "params":deltaEngageParams};
            
            if(isRunningOnCordova() && savedOptions.deltadnaEnabled){
                
                log("[analitics.requestEngagement] Requesting engagement to DeltaDNA on: " + decisionPoint, obj);

                w.deltadna.requestEngagement(
                    obj,
                    function(response){
                        log("[DeltaDNA] requestEngagement Ok ",response);
                        callEngageSuccessCallback(decisionPoint, response);
                    },
                    function(errorResponse){
                        err("[DeltaDNA] requestEngagement ERROR ",errorResponse);
                        callEngageFailureCallback(errorResponse);
                    }
                );
                // clear already sent engage parameters
                deltaEngageParams = {};   
            }
        };
        s.analitics.addTransactionProperty = function(propertyName, propertyValue) {
            analiticsTransactionProperties[propertyName] = propertyValue;
        };
        s.analitics.recordTransaction = function() {
            
            
            if (!isRunningOnCordova()) {
                return log("[analitics.recordTransaction] not available outside device");
            }

            // -----
            // ----- FIXME !!! CONVERT FROM CONTRUCT2 CODE -----
            // -----

            if (!this.store) {
                throw new Error("Store Undefined: missing configuration?");
            }
            // last succesfully bought product with stargate iap
            var transaction = {
                productId: this.IAP_productId,
                productAmountCent: this.store.getProductAmountCent(this.IAP_productId),
                productCurrency: this.store.getProductCurrency(this.IAP_productId),
                productName: this.store.getProductName(this.IAP_productId),
                id: this.IAP_lastTransactionOrderId,
                type: this.store.getProductType(this.IAP_productId)
            };
            
            if(savedOptions.deltadnaEnabled){
                var revenueValidationEnabled = true;
                console.log("[Analitics_RecordTransaction] deltaDNA ", transaction);

                if (typeof window.deltadna == 'undefined') {
                    throw new Error("Deltadna Undefined: missing cordova plugin?");
                }
                var transactionDeltadna = {
                    "transactionName": transaction.productName,
                    "transactionType": "PURCHASE",
                    "transactionID": transaction.id,
                    "productID": transaction.productId,
                    "productsSpent": {
                        "realCurrency":{
                            "realCurrencyAmount":transaction.productAmountCent,//Will be seen as 0.99
                            "realCurrencyType":transaction.productCurrency
                        }
                    },
                    "productsReceived":{
                        "items":[{
                            "item":{
                                "itemName":transaction.productName,
                                "itemAmount":1,
                                "itemType":transaction.type
                            }
                        }]
                    }
                };
                for (var attrname in analiticsTransactionProperties) {
                    transactionDeltadna[attrname] = analiticsTransactionProperties[attrname];
                }
                if (revenueValidationEnabled) {
                    transactionDeltadna["transactionServer"] = "UNKNOWN";
                    transactionDeltadna["transactionReceipt"] = this.IAP_lastTransactionReceipt;
                    if (isRunningOnIos()) {
                        transactionDeltadna["transactionServer"] = "APPLE";
                    }
                    if (isRunningOnAndroid()) {
                        transactionDeltadna["transactionServer"] = "GOOGLE";
                        transactionDeltadna["transactionReceipt"] = this.IAP_lastTransactionResult.originalJson;
                        transactionDeltadna["transactionReceiptSignature"] = this.IAP_lastTransactionSignature;
                    }
                }

                log("[analitics.recordTransaction] DeltaDNA recordTransaction sending to native: ", transactionDeltadna);

                w.deltadna.recordTransaction(
                    transactionDeltadna,
                    function(result){
                        log("[DeltaDNA] recordTransaction completed ", result);
                    },
                    function(error){
                        err("[DeltaDNA] recordTransaction error!", error);
                    }
                );

            }
            if(savedOptions.mixpanelEnabled){
                if (typeof w.mixpanel == 'undefined') {
                    throw new Error("Mixpanel Undefined: missing cordova plugin?");
                }
                var timestamp = new Date().toISOString().substring(0, 19);
                var amount = Math.round(transaction.productAmountCent * 100) / 100;
                console.log("[Analitics_RecordTransaction] mixpanel amount: "+amount+", ts: "+timestamp);
                w.mixpanel.trackCharge(
                    amount,
                    {"$time":timestamp},
                    function(result){
                        log("[DeltaDNA] recordTransaction completed ", result);
                    },
                    function(error){
                        err("[DeltaDNA] recordTransaction error!", error);
                    }
                );
            }
            analiticsTransactionProperties = {};

            // -----------------------------------------
            // -------------- END FIXME ----------------
            // -----------------------------------------
        };
        // -----------------------------
        //       ANALITICS END
        // -----------------------------
        var splashScreenHideCalled = false;
        s.hideSplashScreen = function() {
            if (! isRunningOnCordova())
                return;

            if (typeof window["navigator"] == 'undefined' || typeof window["navigator"]["splashscreen"] == 'undefined')
                return err("splashscreen undefined, missing cordova plugin ?");
            
            splashScreenHideCalled = true;
            w.navigator.splashscreen.hide();
        };

        // -----------------------------
        //         IAP START
        // -----------------------------

        // -----------------------------
        //          IAP END
        // -----------------------------
        
        /**
        *    
        * gameIsLoaded() call it when the game have finished loading, 
        *                it will enable callbacks that need the User Interface
        *                to be ready, like stargate.callbacks.pushNotification
        *    
        */
        s.gameIsLoaded = function() {
            isGameLoaded = true;

            if (isRunningOnCordova()) {
                // hide again splash screen (if client forget to call it)
                if (!splashScreenHideCalled)
                    s.hideSplashScreen();

                // if there are pending push
                if(Object.keys(stargatePushData).length !== 0){
                    
                    // ... send them to user
                    callPushNotificationCallback();
                }

                // FIXME: appsflyer code
                //if (this.installConversionDataLoadedIsToTrigger) {
                //    this.runtime.trigger(cr.plugins_.StargateJS.prototype.cnds.AppsFlyer_OnInstallConversionDataLoaded, this);
                //    this.installConversionDataLoadedIsToTrigger = false;
                //}
            }
        };

        var initDone = false;
        var initDeviceDone = false;

        var onDeviceReady = function () {            
            initDevice();
            initCordova();
            initDeltadna();

            initDeviceDone = true;
        };

        /**
        *    
        * init() call it after setting options, 
        *        after init() option will not be
        *        read anymore
        *    
        */
        s.init = function () {
            if (initDone) {
                throw new Error("Init already done");
            }
            if (!isRunningOnCordova()) {
                return log("Not running on Cordova");
            }

            // save options internally, we don't want to let them change after init
            savedOptions = w.stargate.options;

            // finish the initialization of cordova plugin when deviceReady is received
            document.addEventListener('deviceready', onDeviceReady, false);
            
            //
            // FIXME: wait for completition of deviceReady init!!
            //

            initDone = true;
            return true;
        };

        return s;
    }


    //define globally if it doesn't already exist
    if(typeof(stargate) === 'undefined'){
        w.stargate = define_stargate();
    }
    else{
        throw new Error("Stargate already defined.");
    }

})(window);


