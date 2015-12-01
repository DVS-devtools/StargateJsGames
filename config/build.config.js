var pkg = require('../package.json');

module.exports = {
	banner: '/*!\n' +
	    ' * StargateJS\n' +
	    ' * v' + pkg.version +'\n' +
	    ' * Copyright 2015 DMobileLab. http://buongiorno.com/\n' +
	    ' * See LICENSE in this repository for license information\n' +
	    ' */\n',

	closureStart: '(function(w){\n"use strict";\n\n' +
		'function define_stargate(){\n\n' +
		'// Public Stargate Object\n' +
		'var s = {};\n\n',

	closureEnd: '\n\nreturn s;\n}\n\n\n' + 
		'//define globally if it doesnt already exist\n' +
		'if(typeof(stargate) === "undefined"){\nw.stargate = define_stargate();\n}\n' +
		'else{\nthrow new Error("Stargate already defined.");\n}\n\n' +
		'\n})(window);',
	
	version: pkg.version,

	dist: 'dist/',
	bowerAllIncludes: 'includes.bower.js',
	distFile: 'stargate.js'
};