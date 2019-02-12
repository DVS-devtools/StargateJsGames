# StargateJS 

## [!!!] This repository has been deprecated

[![Travis](http://img.shields.io/travis/BuongiornoMIP/StargateJsGames.svg?branch=master&style=flat)](https://travis-ci.org/BuongiornoMIP/StargateJsGames)

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

	Enable DeltaDNA for analitics.

* deltadnaEnviromentKey: default: ''

* deltadnaCollectHostName: default: ''

* deltadnaEngageHostName: default: ''

* deltadnaOnStartSendGameStartedEvent: defaul: true

* deltadnaOnFirstRunSendNewPlayerEvent: defaul: true

* mixpanelEnabled: defaul: false

	Enable MixPanel for analitics.

	Please don't enable simultaneously MixPanel and DeltaDNA otherwise pushnotification won't works.

* gameEnabled: defaul: false

	Enable game service on Android and IOS.

* iapEnabled: defaul: false

	Enable InApp Purchase.

* iapAndroidLicenseKey: defaul: ''

* appsflyerEnabled: defaul: false

* appsflyerDevkey: defaul: ''

* iosItunesAppId: defaul: ''

* heyzapEnabled: defaul: false

* heyzapPublisherId: defaul: ''

* cordovaHideStatusBar: defaul: false

	Hide statusbar on load of application.


### Callbacks

You can set stargate callbacks setting the following keys in `stargate.callbacks` object.

* pushNotification

   	callback called when a push notification is received
   	data sent from push is forwared as the first parameter

* androidBackButton

   	callback called when android back button is pressed
   	if the callback return [true] then the application is closed

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

stargate.options.deltadnaEnabled = true;

// please enter your delta dna keys
stargate.options.deltadnaEnviromentKey = "123456789012345678901234567890";
stargate.options.deltadnaCollectHostName = "http://xxxxxxxxxx.deltadna.net/collect/api";
stargate.options.deltadnaEngageHostName = "http://yyyyyyyyyyyy.deltadna.net";

stargate.callbacks.pushNotification = function(data) {
	// at this point the user already clicked on the push message,
	// now handle push data inside your game, if needed
	// data is an object with properties set on DeltaDNA/MixPanel
	console.log(data);
}

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
	// signal stargate that it can call any pending push callbacks
	stargate.gameIsLoaded();

	// example of a track event
	stargate.analitics.addEventProperty("name", "value");
	stargate.analitics.addEventProperty("name", "value");
	stargate.analitics.trackEvent("eventName");


}

```

### API

#### Initialization

* Init

	`stargate.init()` process all options set and initialize all the components selected.
	It return a promise that is fullfilled when all native components are ready. So you can
	call every part of stargate.

* gameIsLoaded

	You need to call `stargate.gameIsLoaded()` when the game is loaded and is ready to recive callbacks about any push notification received.


#### Common

* hideSplashScreen


#### Analitics

* addEventProperty

* trackEvent

* addEngagementParam

* requestEngagement

* addTransactionProperty


#### IAP

* addProductId

* requestStoreListing

* purchaseProductId

* restorePurchases

* getProductName

* getProductPrice


##### IAP Example

```javascript

stargate.options.iapEnabled = true;

// please enter your android licence key
// @see http://developer.android.com/training/in-app-billing/preparing-iab-app.html#AddToDevConsole
stargate.options.iapAndroidLicenseKey = "xxxxxxx";


stargate.callbacks.listingFail = function(err) {
	console.error(err);
}
stargate.callbacks.purchaseFail = function(err) {
	console.error(err);
}
stargate.callbacks.restoreSuccess = function() {
	console.log("restoreSuccess");
}
stargate.callbacks.restoreFail = function(err) {
	console.error(err);
}
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
	// signal stargate that it can call any pending push callbacks
	stargate.gameIsLoaded();

	// add all products defined on store (max 20 products)
	stargate.iap.addProductId("product_1,product_2");


	stargate.callbacks.listingSuccess = function() {
		console.log("listingSuccess");

		// you can update your shop screen with products and prices
	}

	// get products information from the store
	stargate.iap.requestStoreListing();

	// ... 
}

function purchaseAddOn(productId) {
	var productName = stargate.iap.getProductName(productId);
	var productPrice = stargate.iap.getProductPrice(productId);

	stargate.callbacks.purchaseSuccess = function() {
		console.log("purchaseSuccess");
		alert("Great! You purchased "+productName+" for "+productPrice);

		// 1) please save somewhere that the user purchased the item,
		//  as a succeding purchase of the same product will generate an error
		// user can eventually use the restore function to restore already
		//  purchased items

		// 2) permit to use the purchased item
	}

	// get products information from the store
	stargate.iap.purchaseProductId(productId);

}

function restorePurchases() {

	stargate.callbacks.purchaseSuccess = function(existingPurchases) {
		// FIXME
		console.log(existingPurchases);
	}

	// get already bought products from store
	stargate.iap.restorePurchases();

}

```



License
----

MIT
