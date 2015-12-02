// test


var test = (function(w, s){

	var t = {};

	_onInitDone = function() {
		_hideInitButton();
		_toggleReceived();
	};
	_hideInitButton = function() {
		document.getElementById('initDelta').setAttribute('style', 'display:none;');
		document.getElementById('initIap').setAttribute('style', 'display:none;');
		document.getElementById('initAndroidBack').setAttribute('style', 'display:none;');
	};
	_toggleReceived = function() {
		var parentElement = document.getElementById('deviceready');
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');
        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');
	};

	_init = function() {
		document.getElementById('initDelta').addEventListener("click",function(){
			t.initStargateForDeltadna();
		},false);
		document.getElementById('initIap').addEventListener("click",function(){
			//t.testIap();
		},false);
		document.getElementById('initAndroidBack').addEventListener("click",function(){
			t.testBackButtonExit();
		},false);
		
	};

	t.initStargateForDeltadna = function() {
		// DemoStargateJS test game
		s.options.deltadnaEnabled = true;
		s.options.deltadnaEnviromentKey = "33274876809571482615389339614486";
		s.options.deltadnaCollectHostName = "http://collect7274dmstr.deltadna.net/collect/api";
		s.options.deltadnaEngageHostName = "http://engage7274dmstr.deltadna.net";

		s.init()
			.then(
				function(result){

					console.log("Init Done: ",result);

					_onInitDone();

				},
				function(error){
					console.error("Init Error: ",error);
				}
			);
	};

	t.testInit = function() {
		
		s.init()
			.then(
				function(result){
					console.log("Init Done: ",result);
					_onInitDone();
				},
				function(error){console.error("Init Error: ",error);}
			);
	};

	t.testBackButtonExit = function() {
		s.callbacks.androidBackButton = function() {
			console.log("Back button pressed on test app");
			alert("I'm going to exit app...");
			return true;
		};

		s.init()
			.then(
				function(result){
					console.log("Init Done: ",result);
					console.log("Press back button to continue test");
					_onInitDone();
				},
				function(error){console.error("Init Error: ",error);}
			);
	};
	t.testBackButtonNoExit = function() {
		s.callbacks.androidBackButton = function() {
			console.log("Back button pressed on test app");

			return false;
		};

		s.init()
			.then(
				function(result){
					console.log("Init Done: ",result);
					console.log("Press back button to continue test");
					_onInitDone();
				},
				function(error){console.error("Init Error: ",error);}
			);
	};

	document.addEventListener("DOMContentLoaded", function(event) {
		_init();
	});
	

	return t;

})(window, stargate);
