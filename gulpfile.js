var gulp = require('gulp');
var cli = require('gulp-cli');
var compress = require('compressjs');
var hash = require('gulp-hashsum');
var gulpS3 = require('gulp-s3');
var gulptar = require('gulp-tar');
var source = require('vinyl-source-stream');
var yargs = require('yargs');
var yargsv = yargs.argv;
var runSequence = require('run-sequence');
var gulpGit = require('gulp-git-workingclone');
var gulpInstall = require('gulp-install');
var gulpRename = require('gulp-rename');
var gulpGzip = require('gulp-gzip');
var awspublish = require('gulp-awspublish');
var gulpClean = require('gulp-clean');

var config = {
    repositories: {
        'api':{
            type:'github', // TODO bitbucket too!
            isPrivate:true, // TODO work with public too
            gitToken:'xxxxxxxxxxxxxxxxxxxx', //TODO what happens if removed/false?
            url:'https://github.com/vroudge/randomrepo.git',
            filesToCopy:{ //TODO multiple files management
                'config':['config/config.json.dist', 'config.json'] //original path, rename
            }
        },
        'shipper':{
            type:'github', 
            isPrivate:true, 
            gitToken:'', 
            url:'https://github.com/vroudge/randomrepo.git',
            filesToCopy:{ 
                'config':['src/config.json.dist', 'config.json'] 
            },
            gruntFilePath:'./',
            gruntTasksToRun:'build'
        }
    },
    aws:{
        "key": "youraccesskeyhere",
        "secret": "your_secret_key_here",
        "bucket": "myBucket",
        "region": "eu-west-1"
    }
}

yargs
    .usage('Usage: $0 deploy -repo [string] -to [string] -on [string] ')
    .example('gulp deploy --repo payments --to aws --on ppd --skip-install')
    .demand(['repo', 'to', 'on'])
    .choices('repo', Object.keys(config.repositories))
    .alias('r', 'repo')
    .alias('t', 'to')
    .choices('on', ['ppd', 'prd', 'box',])
    .alias('o','on')
    .showHelpOnFail(true, 'You can use --skip-install to not install npm modules. You can use --branch name-of-branch to send only a specified branch.')
    .argv;

/* TASKS CHAIN */
gulp.task('deploy', function (cb) {
    runSequence('clone', 'checkout', 'copy', 'install', 'tarAndGzip', 'hasher', 'upload', 'cleanup', cb);
});

/* CLONE REPO */
gulp.task('clone', clone);
/* optional: CHECKOUT BRANCH */
gulp.task('checkout', checkout);
/* COPY */
gulp.task('copy', copy);
/* INSTALL NPM PACKAGES */
gulp.task('install', install);
/* optional: LAUNCH GRUNT TASKS */
gulp.task('gruntTasks', gruntTasks);
/* CREATION OF TAR */
gulp.task('tarAndGzip', tarAndGzip);
/* MD5 CREATION */
gulp.task('hasher', hasher);
/* S3 UPLOAD */
gulp.task('upload', upload);
/* CLEANUP */
gulp.task('cleanup', cleanup);

//
//
//

function clone(cb){
    var accessToken = config.repositories[yargsv.repo].isPrivate ? '&access_token=' + config.repositories[yargsv.repo].gitToken : '';
    var remote = config.repositories[yargsv.repo].url+accessToken;
    gulpGit.clone(remote,function (err) {
        if (err) cb(err);
        cb();
    });
}

function checkout(cb){
    if(!yargsv.branch){
        cb();
    }
    gulpGit.checkout(yargsv.branch, {cwd:'./'+yargsv.repo}, function (err) {
        if (err) throw err;
        cb();
    });
}

function copy(cb){
    return gulp.src('./'+yargsv.repo+'/'+config.repositories[yargsv.repo].filesToCopy.config[0])
        .pipe(gulpRename(config.repositories[yargsv.repo].filesToCopy.config[1]))
        .pipe(gulp.dest(yargsv.repo+'/config'));
}

function install(){
    return gulp.src([yargsv.repo+'/package.json'])
        .pipe(gulpInstall());
}

function gruntTasks(cb){
    if(config.repositories[yargsv.repo].gruntTasksToRun.length>0){
        return gulp.task
    } else {
        cb();
    }
}

function tarAndGzip(){
    return gulp.src('./'+yargsv.repo+'/**')
        .pipe(gulptar(yargsv.repo+'.tar'))
        .pipe(gulpGzip({ extension: 'gz' }))
        .pipe(gulp.dest('dist'));
};
tarAndGzip.description = 'Creates a tar of local src folder';


function hasher(){
    return gulp.src('./dist/'+yargsv.repo+'.tar.gz')
        .pipe(hash({
            dest:'./dist',
            filename: yargsv.repo + '.tar.gz.md5', 
            hash:'md5',
            force:true
        }));
}
hasher.description = 'Creates MD5 of tarfile in /dist';

function upload(){
    var publisher = awspublish.create({
        params: {
            Bucket: config.aws.bucket,
            Key:'./builds/'+yargsv.on+'/'+yargsv.repo+'.tar.gz'
        },
        region:config.aws.region,
        accessKeyId: config.aws.key,
        secretAccessKey: config.aws.secret
    });
 
    return gulp.src('./dist/*')
    .pipe(gulpRename(function(path) {
        path.dirname = 'builds/'+yargsv.on+'/';
    }))
     // gzip, Set Content-Encoding headers and add .gz extension 
    // .pipe(awspublish.gzip({ ext: '.gz' }))
 
    // publisher will add Content-Length, Content-Type and headers specified above 
    // If not specified it will set x-amz-acl to public-read by default 
    .pipe(publisher.publish())
 
    // create a cache file to speed up consecutive uploads 
    .pipe(publisher.cache())
 
     // print upload updates to console 
    .pipe(awspublish.reporter());
    
}
upload.description = 'Uploads to S3';

function cleanup(cb){
    return gulp.src(['dist/**', yargsv.repo], {read: false})
        .pipe(gulpClean());
}
