
module.exports = {
    files: [
        'dist/stargate.js',
        'spec/*.js'
    ],

    frameworks: ['jasmine'],
    reporters: ['progress', 'coverage', 'mocha'],

    //preprocessors: {
    //  'src/plugins/*.js': ['coverage']
    //},

    coverageReporter: {
        type : 'html',
        dir : 'coverage/'
    },

    port: 9876,
    colors: true,
    // possible values: 'OFF', 'ERROR', 'WARN', 'INFO', 'DEBUG'
    logLevel: 'INFO',
    autoWatch: true,
    captureTimeout: 60000,
    singleRun: false,

    // Start these browsers, currently available:
    // - Chrome
    // - ChromeCanary
    // - Firefox
    // - Opera (has to be installed with `npm install karma-opera-launcher`)
    // - Safari (only Mac; has to be installed with `npm install karma-safari-launcher`)
    // - PhantomJS
    // - IE (only Windows; has to be installed with `npm install karma-ie-launcher`)
    browsers: ['Chrome']
};