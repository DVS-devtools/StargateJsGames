//////////////////////////////////////
// Android store
function AndroidIosStore(androidApplicationLicenseKey, platform)
{
	this.onpurchasesuccess = null;
	this.onpurchasefail = null;
	
	this.onconsumesuccess = null;
	this.onconsumefail = null;
	
	this.onstorelistingsuccess = null;
	this.onstorelistingfail = null;

	this.onrestorepurchasessuccess = null;
	this.onrestorepurchasesfail = null;
	
	this.product_id_list = [];
	
	this.existing_purchases = [];
	
	this.product_info = {};		// map product id to info

	this.androidApplicationLicenseKey = androidApplicationLicenseKey;
	
	this.initialized = false;

	this.platform = platform;
	
	window.iap.setUp(this.androidApplicationLicenseKey);		
}

AndroidIosStore.prototype.addProductIds = function (idstring)
{
	if (idstring.indexOf(",") === -1) {
		if (this.product_id_list.indexOf(idstring) === -1) {
			this.product_id_list.push(idstring);
		}
	}
	else {
		var arr = idstring.split(",");
		for (var i = 0 ; i < arr.length ; i++) {
			
			if (this.product_id_list.indexOf(arr[i]) === -1) {
				this.product_id_list.push(arr[i]);				
			}
		}
	}
};

AndroidIosStore.prototype.hasProduct = function (product_)
{
	return this.existing_purchases.indexOf(product_) !== -1;
};

AndroidIosStore.prototype.purchaseProduct = function (product_)
{
	var self = this;
	//https://github.com/Wizcorp/phonegap-plugin-wizPurchase/blob/46f32fdf0be4f9c5837fe873efe5d06bf70c6819/www/phonegap/plugin/wizPurchasePlugin/wizPurchasePlugin.js
	//https://github.com/Wizcorp/phonegap-plugin-wizPurchase/tree/46f32fdf0be4f9c5837fe873efe5d06bf70c6819
	window.iap.purchaseProduct(product_, function (result)
	{
		for (var attrname in result) {
        	console.log("[IAP] purchaseProduct result details: '"+attrname+"' = '"+result[attrname]+"'");
        }
		// on success
		if (self.existing_purchases.indexOf(product_) === -1) {
			self.existing_purchases.push(product_);			
		}
		
		if (self.onpurchasesuccess) {
			self.onpurchasesuccess(product_, result);			
		}
		
	},
	function (error)
	{
		console.error("[IAP] purchaseProduct error: " + error);

		// on error
		if (self.onpurchasefail) {
			self.onpurchasefail(product_, error);			
		}
	});
};

AndroidIosStore.prototype.restorePurchases = function ()
{
	var self = this;

	//alert("debug restorePurchases0");
	window.iap.restorePurchases(function (result)
	{
		//alert("debug restorePurchases1: "+JSON.stringify(result));	
	
		// on success
		var i, p;
		for (i= 0 ; i < result.length; ++i)
		{
			p = result[i];				
			//alert("debug restorePurchases2: "+JSON.stringify(p));		
		
			if (self.existing_purchases.indexOf(p.productId) === -1) {
				self.existing_purchases.push(p.productId);				
			}
		}
		
		if (self.onrestorepurchasessuccess) {
			self.onrestorepurchasessuccess(self.existing_purchases);			
		}
	}, 
	function (error)
	{
		//alert("debug restorePurchases3: "+JSON.stringify(error));
		console.error("[IAP] restorePurchases error: " + error);
		
		if (self.onrestorepurchasesfail) {
			self.onrestorepurchasesfail();			
		}
	});
	//alert("debug restorePurchases4");
};

AndroidIosStore.prototype.requestStoreListing = function ()
{
	var self = this;
	
	window.iap.requestStoreListing(self.product_id_list, function (result)
	{
/*
[
{
    "productId": "shield001",
    "title": "Shield of Peanuts",
    "price": "Formatted price of the item, including its currency sign.",
    "description": "A shield made entirely of peanuts."
}

iap.requestStoreListing("com.buongiorno.hybrid.game.test.skyshield.noads", function(a){console.log("success",a)}, function(e){console.error(e)})

success
 [Object]0: Object
   description: "No Ads for Skyshield Test"
   price: "0,50 €"
   productId: "com.buongiorno.hybrid.game.test.skyshield.noads"
   title: "No Ads (Skyshield Test)"
   json: Object
     description: "No Ads for Skyshield Test"
     price: "0,50 €"
     price_amount_micros: 500000
     price_currency_code: "EUR"
     productId: "com.buongiorno.hybrid.game.test.skyshield.noads"
     title: "No Ads (Skyshield Test)
     type: "inapp"
]
*/
		//alert("debug requestStoreListing1: "+JSON.stringify(result));//debug for Caleb
		
		for (var i = 0 ; i < result.length; ++i)
		{
			var p = result[i];
			//alert("debug requestStoreListing2: "+JSON.stringify(p));

			self.product_info[p.productId] = {
				title: p.title,
				price: p.price,
				price_amount_cent: 0,
				price_currency_code: "",
				type: "inapp"
			};

			var priceCent = '';
			if (self.platform === 'android') {
				priceCent = p.json.price_amount_micros / 10000;
				self.product_info[p.productId].price_amount_cent = priceCent;
				self.product_info[p.productId].price_currency_code = p.json.price_currency_code;
				self.product_info[p.productId].type = p.json.type;
			} else if (self.platform === 'ios') {
                priceCent = p.price_amount * 100;
                self.product_info[p.productId].price_amount_cent = priceCent;
                self.product_info[p.productId].price_currency_code = p.price_currency_code;
			}
		}
		
		if (self.onstorelistingsuccess) {
			self.onstorelistingsuccess();
		}
	}, function (error)
	{
		console.error("[IAP] requestStoreListing error: " + error + " | product_id_list: " + self.product_id_list);
		//alert("debug requestStoreListing3: "+JSON.stringify(error));
		if (self.onstorelistingfail) {
			self.onstorelistingfail();
		}
	});
	//alert("debug requestStoreListing4");		
};

AndroidIosStore.prototype.getProductName = function (product_)
{
	if (this.product_info.hasOwnProperty(product_)) {
		return this.product_info[product_].title;
	}
	else {
		console.warn("[StargateIAP] product not available: "+product_);
		return "";			
	}
};
AndroidIosStore.prototype.getProductAmountCent = function (product_)
{
	if (this.product_info.hasOwnProperty(product_)) {
		return this.product_info[product_].price_amount_cent;
	}
	else {
		console.warn("[StargateIAP] product not available: "+product_);
		return 0;			
	}
};
AndroidIosStore.prototype.getProductCurrency = function (product_)
{
	if (this.product_info.hasOwnProperty(product_)) {
		return this.product_info[product_].price_currency_code;
	}
	else {
		console.warn("[StargateIAP] product not available: "+product_);
		return 0;			
	}
};
AndroidIosStore.prototype.getProductType = function (product_)
{
	if (this.product_info.hasOwnProperty(product_)) {
		return this.product_info[product_].type;
	}
	else {
		console.warn("[StargateIAP] product not available: "+product_);
		return 0;			
	}
};

AndroidIosStore.prototype.getProductFormattedPrice = function (product_)
{
	// may not be immediately available in onstorelistingsuccess...
	if (this.product_info.hasOwnProperty(product_)) {
		return this.product_info[product_].price.toString();
	}
	else {
		return "";
	}
};
