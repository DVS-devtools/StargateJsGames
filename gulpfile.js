// Platform to use for run/emulate
var testPlatform = 'android';

var gulp = require('gulp'),
	mainBowerFiles = require('main-bower-files'),
    jshint = require('gulp-jshint'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    concat = require('gulp-concat'),
    notify = require('gulp-notify'),
    del = require('del'),
    webserver = require('gulp-webserver'),
    plumber = require('gulp-plumber'),
    watch = require('gulp-watch'),
    argv = require('minimist')(process.argv.slice(2)),
    karma = require('karma'),
  	karmaConf = require('./config/karma.conf.js');

var cordova_lib = require('cordova-lib'),
	path = require('path');

var cdv = cordova_lib.cordova.raw;

// path of cordova test project
var cordovaTestProjectDir = path.join(__dirname, 'test');


gulp.task('build:bower', function() {
	// take all bower includes and concatenate them,
	// in a file to be included before others
	// so name it with _ to be first in natural order
	// when included by task build:src
	return gulp.src(mainBowerFiles())
		.pipe(concat('_includes.bower.js'))
		.pipe(gulp.dest('src/'));
});


gulp.task('build:src', ['build:bower'], function() {
	return gulp.src('src/**/*.js')
	    .pipe(jshint('.jshintrc'))
	    .pipe(jshint.reporter('jshint-stylish'))
	    .pipe(concat('stargate.js'))
	    .pipe(gulp.dest('dist/'))
	    .pipe(gulp.dest('test/www/js/'))
	    .pipe(rename({suffix: '.min'}))
	    .pipe(uglify())
	    .pipe(gulp.dest('dist/'))
	    .pipe(notify({ title: "Build Success", message: 'Build StargateJS completed' }));
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
gulp.task('build:src:checkjs', ['build:bower'], function() {
	return gulp.src('src/**/*.js')
		.pipe(plumber({errorHandler: jsHintErrorAlert}))
	    .pipe(jshint('.jshintrc'))
	    .pipe(jshint.reporter('jshint-stylish'))
	    .pipe(jshint.reporter('fail'))
	    .pipe(concat('stargate.js'))
	    .pipe(gulp.dest('dist/'))
	    .pipe(gulp.dest('test/www/js/'))
	    .pipe(rename({suffix: '.min'}))
	    .pipe(uglify())
	    .pipe(gulp.dest('dist/'))
	    .pipe(notify({ title: "Build Success", message: 'Build StargateJS completed' }));
});

gulp.task('serve', function() {
  gulp.src('test/www/')
    .pipe(webserver({
    	//path: 'test/www/',
      	livereload: true,
      	fallback: 'index.html',
      	directoryListing: false,
      	open: true
    }));
});

gulp.task('clean:cordova', function () {
	// delete platforms and plugins
	return del([
		'test/platforms/',
		'test/plugins/'
	])
	.then(function() {
		return process.chdir(cordovaTestProjectDir);
	})
	.then(function() {
		// add platform and download again plugin specified by config.xml
    	return cdv.platform('add', [testPlatform])
	});
});

gulp.task('lint:jshint', ['build:bower'], function() {
	return gulp.src('src/**/*.js')
	    .pipe(jshint('.jshintrc'))
	    .pipe(jshint.reporter('jshint-stylish'))
	    .pipe(jshint.reporter('fail'));
});

gulp.task('default', ['build:src'] );
gulp.task('build', ['build:src'] );



gulp.task('lint', ['lint:jshint'] );
gulp.task('test', ['karma'] );

gulp.task('clean', ['clean:cordova'] );


gulp.task('run', ['build:src'], function(cb) {
    process.chdir(cordovaTestProjectDir);
    return cdv.run({platforms:[testPlatform], options:['--device']});
});

gulp.task('karma', function (done) {
	
	karmaConf.singleRun = true;
	argv.browsers && (karmaConf.browsers = argv.browsers.trim().split(','));
	argv.reporters && (karmaConf.reporters = argv.reporters.trim().split(','));

	new karma.Server(karmaConf, done).start();
});

