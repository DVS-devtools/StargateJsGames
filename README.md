[![Travis](http://img.shields.io/travis/BuongiornoMIP/StargateJsGames.svg?branch=master&style=flat)](https://travis-ci.org/BuongiornoMIP/StargateJsGames)


# StargateJS 

StargateJS is a javascript library that enable game developer to use native device functionality of several external services for

  - Analitics
  - Store game services
  - Push notification
  - In App Purchases
  - Many more



### Version

0.1.0


### Options

You can set stargate options setting the following keys in `stargate.options` object.

You have to set options before calling `stargate.init()`.


* deltadnaEnabled: defaul: false

* deltadnaEnviromentKey: default: ''

* deltadnaCollectHostName: default: ''

* deltadnaEngageHostName: default: ''

* deltadnaOnStartSendGameStartedEvent: defaul: true

* deltadnaOnFirstRunSendNewPlayerEvent: defaul: true

* mixpanelEnabled: defaul: false

* gameEnabled: defaul: false

* iapEnabled: defaul: false

* iapAndroidLicenseKey: defaul: ''

* appsflyerEnabled: defaul: false

* appsflyerDevkey: defaul: ''

* iosItunesAppId: defaul: ''

* heyzapEnabled: defaul: false

* heyzapPublisherId: defaul: ''

* cordovaHideStatusBar: defaul: false


### Callbacks

You can set stargate callbacks setting the following keys in `stargate.callbacks` object.

* pushNotification

   	callback called when a push notification is received
   	data sent from push is forwared as the first parameter

* androidBackButton

   	callback called when android back button is pressed
   	if the callback return [true] then application is closed

* engageSuccess

   	callback called when a DeltaDNA engage terminates successfully
   	data sent from DeltaDNA is forwared as the first parameter

* engageFailure

   	callback called when a DeltaDNA engage fail

* iap.purchaseSuccess

   	callback called when an IAP purchase terminates successfully

* iap.purchaseFail

   	callback called when an IAP purchase fail

* iap.listingSuccess

   	callback called when an IAP listing terminates successfully

* iap.listingFail

   	callback called when an IAP listing fail

* iap.restoreSuccess

   	callback called when an IAP restore request terminates successfully

* iap.restoreFail

   	callback called when an IAP restore request fail


### Example

```javascript

// please enter your delta dna keys
stargate.options.deltadnaEnabled = true;
stargate.options.deltadnaEnviromentKey = "123456789012345678901234567890";
stargate.options.deltadnaCollectHostName = "http://xxxxxxxxxx.deltadna.net/collect/api";
stargate.options.deltadnaEngageHostName = "http://yyyyyyyyyyyy.deltadna.net";

stargate.init()
	.then(
		function(result){

			console.log("Init Done: ",result);

			startLoading();

		},
		function(error){

			console.error("Init Error: ",error);

		}
	);

function startLoading() {
	// start loader 
	// on load complete call onLoadComplete()

}

function onLoadComplete() {
	stargate.hideSplashScreen();

	gameLoop();
}

function gameLoop() {

	stargate.analitics.addEventProperty("name", "value");
	stargate.analitics.addEventProperty("name", "value");

	stargate.analitics.trackEvent("eventName");


}

```


License
----

MIT
