// Platform to use for run/emulate
var testPlatform = 'android';

var gulp = require('gulp'),
	fs = require('fs'),
	mainBowerFiles = require('main-bower-files'),
    jshint = require('gulp-jshint'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    concat = require('gulp-concat'),
    notify = require('gulp-notify'),
    notifier = require('node-notifier'),
    footer = require('gulp-footer'),
 	header = require('gulp-header'),
    del = require('del'),
    webserver = require('gulp-webserver'),
    plumber = require('gulp-plumber'),
    watch = require('gulp-watch'),
    argv = require('minimist')(process.argv.slice(2)),
    karma = require('karma'),
    buildConfig = require('./config/build.config'),
  	karmaConf = require('./config/karma.conf.js');

var cordova_lib = require('cordova-lib'),
	path = require('path');

var cdv = cordova_lib.cordova.raw;

// path of cordova test project
var cordovaTestProjectDir = path.join(__dirname, 'demo');


gulp.task('build:bower', function() {
	// take all bower includes and concatenate them,
	// in a file to be included before others
	return gulp.src(mainBowerFiles())
		.pipe(concat(buildConfig.bowerAllIncludes))
		.pipe(gulp.dest(buildConfig.dist));
});


gulp.task('build:src:nonotify', ['build:bower'], function() {
	return gulp.src('src/**/*.js')
		.pipe(concat(buildConfig.distFile))
		.pipe(header(buildConfig.closureStart))
		.pipe(footer(buildConfig.closureEnd))
	    .pipe(jshint('.jshintrc'))
	    .pipe(jshint.reporter('jshint-stylish'))
	    .pipe(header(fs.readFileSync(buildConfig.dist + buildConfig.bowerAllIncludes, 'utf8')))
	    .pipe(gulp.dest(buildConfig.dist))
	    .pipe(gulp.dest('test/www/js/'))
	    .pipe(rename({suffix: '.min'}))
	    .pipe(uglify())
	    .pipe(header(buildConfig.banner))
	    .pipe(gulp.dest(buildConfig.dist));
});

gulp.task('build:src', ['build:src:nonotify'], function() {
	notifier.notify({ title: "Build Success", message: 'Build StargateJS completed' });
});


// alternative build:src that lint source and fail with a message if it's not valid
function jsHintErrorAlert(error){
	notify.onError({
		title: "Build Error",
		message: 'Error: <%= error.message %>',
		sound: "Sosumi"}
	)(error); //Error Notification
	console.log(error.toString());//Prints Error to Console
	this.emit("end"); //End function
};
// FIXME old build:src configuration
gulp.task('build:src:checkjs', ['build:bower'], function() {
	return gulp.src('src/**/*.js')
		.pipe(plumber({errorHandler: jsHintErrorAlert}))
	    .pipe(jshint('.jshintrc'))
	    .pipe(jshint.reporter('jshint-stylish'))
	    .pipe(jshint.reporter('fail'))
	    .pipe(concat(buildConfig.distFile))
	    .pipe(gulp.dest(buildConfig.dist))
	    .pipe(gulp.dest('demo/www/js/'))
	    .pipe(rename({suffix: '.min'}))
	    .pipe(uglify())
	    .pipe(gulp.dest(buildConfig.dist))
	    .pipe(notify({ title: "Build Success", message: 'Build StargateJS completed' }));
});

gulp.task('demo:serve', function() {
  gulp.src('demo/www/')
    .pipe(webserver({
    	//path: 'demo/www/',
      	livereload: true,
      	fallback: 'index.html',
      	directoryListing: false,
      	open: true
    }));
});

gulp.task('demo:clean', function () {
	// delete platforms and plugins
	return del([
		'demo/platforms/',
		'demo/plugins/'
	])
	.then(function() {
		return process.chdir(cordovaTestProjectDir);
	})
	.then(function() {
		// add platform and download again plugin specified by config.xml
    	return cdv.platform('add', [testPlatform])
	});
});

gulp.task('lint:jshint', function() {
	return gulp.src('src/**/*.js')
		.pipe(concat(buildConfig.distFile + '.lint.tmp.js'))
		.pipe(header(buildConfig.closureStart))
		.pipe(footer(buildConfig.closureEnd))
		.pipe(gulp.dest(buildConfig.dist))
	    .pipe(jshint('.jshintrc'))
	    .pipe(jshint.reporter('jshint-stylish'))
	    .pipe(jshint.reporter('fail'));
});

gulp.task('default', ['build:src'] );
gulp.task('build', ['build:src'] );



gulp.task('lint', ['lint:jshint'] );
gulp.task('test', ['karma'] );

gulp.task('clean', ['demo:clean'] );


gulp.task('demo:run', ['build:src'], function(cb) {
    process.chdir(cordovaTestProjectDir);
    return cdv.run({platforms:[testPlatform], options:['--device']});
});

gulp.task('karma', ['build'], function (done) {
	
	karmaConf.singleRun = true;
	argv.browsers && (karmaConf.browsers = argv.browsers.trim().split(','));
	argv.reporters && (karmaConf.reporters = argv.reporters.trim().split(','));

	new karma.Server(karmaConf, done).start();
});

