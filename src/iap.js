// -----------------------------
//         IAP START
// -----------------------------

var iap = {};
iap.store = null;
iap.lastTransactionOrderId = "";
iap.lastTransactionReceipt = "";
iap.lastTransactionSignature = "";
iap.lastTransactionResult = {};

var initIap = function() {

    if (!savedOptions.iapEnabled) {
        return;
    }
    if (!!!savedOptions.iapAndroidLicenseKey) {
        throw new Error("Iap Android License Key undefined");
    }

    if (typeof w.iap == 'undefined') {
        throw new Error("Iap Undefined, missing cordova plugin ?");
    }

    if (isRunningOnAndroid()) {
        iap.store = new AndroidStore(savedOptions.iapAndroidLicenseKey, 'android');
    }
    else if (isRunningOnIos()) {
        iap.store = new AndroidStore(savedOptions.iapAndroidLicenseKey, 'ios');
    }
    else {
        throw new Error("Platform not supported!");
    }
    
    iap.store.onpurchasesuccess = function(product, result) {
        
        iap.lastTransactionResult = result;
        iap.lastTransactionOrderId = result.orderId;
        iap.lastTransactionReceipt = result.receipt;
        if (result.signature) {
            iap.lastTransactionSignature = result.signature;
        } else {
            iap.lastTransactionSignature = "";
        }

        // record the transaction on analitics services
        recordTransaction(product);

        callIapPurchaseSuccessCallback(product, result);
    };
    
    iap.store.onpurchasefail = function(product, error) {
        callIapPurchaseFailCallback(product, error);
    };
    
    iap.store.onstorelistingsuccess = function() {
        callIapListingSuccessCallback();
    };
    
    iap.store.onstorelistingfail = function() {
        callIapListingFailCallback();
    };
    iap.store.onrestorepurchasessuccess = function() {
        callIapRestoreSuccessCallback();
    };
    
    iap.store.onrestorepurchasesfail = function() {
        callIapRestoreFailCallback();
    };
};

s.iap = {};

/**
*    addProductId(productId): 
*       add every product you want to use later
*       you have to call this before requestStoreListing
*/
s.iap.addProductId = function(productIds) {
    if (! isRunningOnCordova()) return;
    if (typeof w.iap == 'undefined') return err("iap undefined, missing cordova plugin ?");
    return iap.store && iap.store.addProductIds(productIds);
};

/**
*    requestStoreListing(): 
*       get information from the store for added product id
*       on finish success or fail it will call the saved callbacks
*/
s.iap.requestStoreListing = function() {
    if (! isRunningOnCordova()) return;
    if (typeof w.iap == 'undefined') return err("iap undefined, missing cordova plugin ?");
    return iap.store && iap.store.requestStoreListing();
};

/**
*    purchaseProductId(productId): 
*       purchase a productId
*       on finish success or fail it will call the saved callbacks
*/
s.iap.purchaseProductId = function(productId) {
    if (! isRunningOnCordova()) return;
    if (typeof w.iap == 'undefined') return err("iap undefined, missing cordova plugin ?");
    return iap.store && iap.store.purchaseProduct(productId);
};

/**
*    restorePurchases(): 
*       restore purchases already done by the user on this application
*       on finish success or fail it will call the saved callbacks
*/
s.iap.restorePurchases = function() {
    if (! isRunningOnCordova()) return;
    if (typeof w.iap == 'undefined') return err("iap undefined, missing cordova plugin ?");
    return iap.store && iap.store.restorePurchases();
};

s.iap.getProductName = function(productId) {
    if (! isRunningOnCordova()) return;
    if (typeof w.iap == 'undefined') return err("iap undefined, missing cordova plugin ?");
    return (iap.store ? iap.store.getProductName(productId) : "");
};
s.iap.getProductPrice = function(productId) {
    if (! isRunningOnCordova()) return;
    if (typeof w.iap == 'undefined') return err("iap undefined, missing cordova plugin ?");
    return (iap.store ? iap.store.getProductFormattedPrice(productId) : "");
};



// -----------------------------
//          IAP END
// -----------------------------
