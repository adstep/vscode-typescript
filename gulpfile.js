'use strict';

var config = require('./gulp.config')();
var del = require('del');
var glob = require('glob');
var path = require('path');
var args = require('yargs').argv;
var exec = require('child_process').exec;
var browserSync = require('browser-sync');
var tslintStylish = require('tslint-stylish');
var ts = require('gulp-typescript');
var sourcemaps = require('gulp-sourcemaps');
var gulp = require('gulp');
var gulpSequence = require('gulp-sequence');
var replace = require('gulp-replace');
var tsconfig = require('gulp-tsconfig-files');
var watch = require('gulp-watch');
var $ = require('gulp-load-plugins')({ lazy: true });

var tsProject = ts.createProject('./tsconfig.json', {
    rootDir: config.ts.src,
    outDir: config.ts.out
});

/**
 * List the available gulp tasks
 */
gulp.task('help', $.taskListing.withFilters(/:/));
gulp.task('default', ['help']);

/**
 * Remove generated files
 * @return {Stream}
 */
gulp.task('clean', function () {
    return del(config.ts.out);
});

/**
 * Compile TypeScript
 */
gulp.task('internal-compile', [], function () {
    log('Compiling TypeScript');

    var tsResult = tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(ts(tsProject));

   tsResult.js
        .pipe(sourcemaps.write('.', {
            includeContent: false,
            sourceRoot: function(file) {
                let depth = file.history[0].match(/\\/g).length;
                return '../'.repeat(depth) + 'src';
        }}))
        .pipe(gulp.dest(config.ts.out));
});

gulp.task('build', function (cb) {
    gulpSequence(['clean'], ['internal-compile'])(cb);
});

/**
 * Watch and compile TypeScript
 */
gulp.task('ts-watch', ['internal-compile'], function () {
    return gulp.watch(config.ts.files, ['internal-compile']);
});

/**
 * Run specs once and exit
 * @return {Stream}
 */
gulp.task('test', [], function () {
    startTests(true /*singleRun*/);
});

/**
 * Run specs and wait.
 * Watch for file changes and re-run tests on each change
 */
gulp.task('test:watch', [], function () {
    startTests(false /*singleRun*/);
});

/**
 * Run the spec runner
 * @return {Stream}
 */
gulp.task('test:serve', ['internal-test-build'], function () {
    log('Running the spec runner');
    
    serveSpecRunner();
    watch(config.ts.files, function() {
       gulp.start('internal-test-build');
    });
});

gulp.task('internal-test-build', [], function(cb) {
     gulpSequence(['build'], ['internal-imports-inject'])(cb);
});

/**
 * vet typescript code
 * @return {Stream}
 */
gulp.task('tslint', function () {

    log('Analyzing typescript code with TSLint');

    return gulp
        .src(config.ts.files)
        .pipe($.tslint())
        .pipe($.tslint.report(tslintStylish, {
            emitError: false,
            sort: true,
            bell: false
        }));
});

/**
 * Inject imports into system.js
 * @return {Stream}
 */
gulp.task('internal-imports-inject', function(){

    log('Injecting imports into system.js');

    gulp.src(config.customBoot)
        .pipe($.inject(gulp.src(config.js.specs, {read: false}), {
            starttag: 'Promise.all([',
            endtag: '])',
            transform: function (filepath, file, i, length) {
                var importStatement = 'System.import(\'' + filepath + '\')';
                if (i !== length - 1) {
                    importStatement += ',';
                }
                return importStatement;
            }
        }))
        .pipe(gulp.dest('./util/', {overwrite: true}));
});

/**
 * Generates a random integer
 * @param  {number} min - Lower bound (inclusive) for generated number
 * @param  {number} max - Upper bound (exclusive) fro generated number
 * @returns {number}
 */
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Log a message or series of messages using chalk's blue color.
 * Can pass in a string, object or array.
 */
function log(msg) {

    if (typeof (msg) === 'object') {
        for (var item in msg) {
            if (msg.hasOwnProperty(item)) {
                $.util.log($.util.colors.blue(msg[item]));
            }
        }
    } else {
        $.util.log($.util.colors.blue(msg));
    }
}

/**
 * Start the tests using karma.
 * @param  {boolean} singleRun - True means run once and end (CI), or keep running (dev)
 * @returns {undefined}
 */
function startTests(singleRun) {

    var Server = require('karma').Server;

    log('Karma started');

    var server = new Server({
        configFile: __dirname + '/karma.conf.js',
        exclude: config.karma.exclude,
        singleRun: !!singleRun
    });

    server.on('run_complete', function (browser, result) {
        log('Karma completed');
    });

    server.start();
}

/**
 * Order a stream
 * @param   {Stream} src   The gulp.src stream
 * @param   {Array} order Glob array pattern
 * @returns {Stream} The ordered stream
 */
function orderSrc(src, order) {

    return gulp
        .src(src)
        .pipe($.if(order, $.order(order)));
}

/**
 * Inject files as strings at a specified inject label
 * @param   {Array} src   glob pattern for source files
 * @param   {String} label   The label name
 * @returns {Stream}   The stream
 */
function injectString(src, label) {

    var search = '/// inject:' + label;
    var first = '\n    System.import(\'';
    var last = '\')';
    var specNames = [];

    src.forEach(function(pattern) {
        glob.sync(pattern)
            .forEach(function(file) {
                var fileName = '/' + path.basename(file, path.extname(file));
                var specName = [path.dirname(file), fileName].join('');
                specNames.push(first + specName + last);
            });
    });

    return $.injectString.after(search, specNames);
}

/**
 * Start BrowserSync
 * --verbose
 */
function serveSpecRunner() {

    if (browserSync.active) {
        return;
    }

    log('Starting BrowserSync on port ' + config.browserSyncPort);

    var options = {
        port: config.browserSync.port,
        server: config.root,
        files: config.ts.src,
        logFileChanges: true,
        logLevel: config.browserSync.logLevel,
        logPrefix: config.browserSync.logPrefix,
        notify: true,
        reloadDelay: 1000,
        startPath: config.specRunnerFile
    };

    if (args.verbose) {
        options.logLevel = 'debug';
    }

    browserSync(options);
}
