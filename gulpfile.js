var gulp = require('gulp'),
	mainBowerFiles = require('main-bower-files'),
    jshint = require('gulp-jshint'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    concat = require('gulp-concat'),
    notify = require('gulp-notify'),
    livereload = require('gulp-livereload');

gulp.task('bowerize', function() {
	return gulp.src(mainBowerFiles())
		.pipe(concat('_includes.bower.js'))
		.pipe(gulp.dest('src/'));
});


gulp.task('buildsrc', ['bowerize'], function() {
	return gulp.src('src/**/*.js')
	    .pipe(jshint())
	    .pipe(jshint.reporter('default'))
	    .pipe(concat('stargate.js'))
	    .pipe(gulp.dest('dist/'))
	    .pipe(rename({suffix: '.min'}))
	    .pipe(uglify())
	    .pipe(gulp.dest('dist/'));
});

gulp.task('default', ['buildsrc'], function() {
	return notify({ message: 'Build StargateJS completed' });
});