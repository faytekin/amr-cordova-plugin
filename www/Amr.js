var argscheck = require('cordova/argscheck'),
    exec = require('cordova/exec');

var amrExport = {};

/**
 * This enum represents Amr's supported ad sizes.  Use one of these
 * constants as the adSize when calling createBannerView.
 * @const
 */
amrExport.AD_SIZE = {
  BANNER: 50,
  LEADERBOARD: 90,
  MEDIUM_RECTANGLE: 250
};

amrExport.setOptions =
	function(options, successCallback, failureCallback) {
	  if(typeof options === 'object' 
		  && typeof options.amrAppId === 'string'
	      && options.amrAppId.length > 0) {
		  cordova.exec(
			      successCallback,
			      failureCallback,
			      'Amr',
			      'setOptions',
			      [options]
			  );
	  } else {
		  if(typeof failureCallback === 'function') {
			  failureCallback('options.amrAppId should be specified.')
		  }
	  }
	};
	
amrExport.initAMR =
function(options, successCallback, failureCallback) {
  cordova.exec(
      successCallback,
      failureCallback,
      'Amr',
      'initAMR',
      [ options ]
  );
};

amrExport.setUserConsent =
function(options, successCallback, failureCallback) {
    cordova.exec(
                 successCallback,
                 failureCallback,
                 'Amr',
                 'setUserConsent',
                 [ options ]
                 );
};

amrExport.subjectToGdpr =
function(options, successCallback, failureCallback) {
    cordova.exec(
                 successCallback,
                 failureCallback,
                 'Amr',
                 'subjectToGdpr',
                 [ options ]
                 );
};

amrExport.startTestSuite =
function(options, successCallback, failureCallback) {
    cordova.exec(
                 successCallback,
                 failureCallback,
                 'Amr',
                 'startTestSuite',
                 [ options ]
                 );
};

	
amrExport.createBannerAd =
function(options, successCallback, failureCallback) {
  if(typeof options === 'undefined' || options == null) options = {};
  cordova.exec(
      successCallback,
      failureCallback,
      'Amr',
      'createBannerAd',
      [ options ]
  );
};

amrExport.createInterstitialAd =
function(options, successCallback, failureCallback) {
  cordova.exec(
      successCallback,
      failureCallback,
      'Amr',
      'createInterstitialAd',
      [ options ]
  );
};

amrExport.createVideoAd =
function(options, successCallback, failureCallback) {
  cordova.exec(
      successCallback,
      failureCallback,
      'Amr',
      'createVideoAd',
      [ options ]
  );
};

amrExport.destroyBannerAd =
function(options, successCallback, failureCallback) {
  if(typeof options === 'undefined' || options == null) options = {};
  cordova.exec(
	      successCallback,
	      failureCallback,
	      'Amr',
	      'destroyBannerAd',
	      []
	  );
};

amrExport.requestBannerAd =
function(options, successCallback, failureCallback) {
	  if(typeof options === 'undefined' || options == null) options = {};
  cordova.exec(
      successCallback,
      failureCallback,
      'Amr',
      'requestBannerAd',
      [ options ]
  );
};

amrExport.requestInterstitialAd =
function(options, successCallback, failureCallback) {
	  if(typeof options === 'undefined' || options == null) options = {};
  cordova.exec(
      successCallback,
      failureCallback,
      'Amr',
      'requestInterstitialAd',
      [ options ]
  );
};

amrExport.requestVideoAd =
function(options, successCallback, failureCallback) {
	  if(typeof options === 'undefined' || options == null) options = {};
  cordova.exec(
      successCallback,
      failureCallback,
      'Amr',
      'requestVideoAd',
      [ options ]
  );
};

amrExport.showBannerAd = 
function( show, successCallback, failureCallback) {
	if (show === undefined) {
		show = true;
	}

	cordova.exec(
		successCallback,
		failureCallback, 
		'Amr', 
		'showBannerAd', 
		[ show ]
	);
};

amrExport.showInterstitialAd = 
	function( show, successCallback, failureCallback) {
		if (show === undefined) {
			show = true;
		}

		cordova.exec(
			successCallback,
			failureCallback, 
			'Amr', 
			'showInterstitialAd', 
			[ show ]
		);
	};

amrExport.showVideoAd = 
	function( show, successCallback, failureCallback) {
		if (show === undefined) {
			show = true;
		}

		cordova.exec(
			successCallback,
			failureCallback, 
			'Amr', 
			'showVideoAd', 
			[ show ]
		);
	};	

module.exports = amrExport;