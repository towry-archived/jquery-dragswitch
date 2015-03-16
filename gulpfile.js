var gulp = require('gulp');
var concat = require('gulp-concat');

gulp.task('default', function () {
  gulp.watch('dragswitch.js', ['watchify'])
});

gulp.task('watchify', function () {
  gulp.src(_sourceFiles())
    .pipe(concat('jquery.dragswitch.js'))
    .pipe(gulp.dest('./dist/'));
});

function _sourceFiles () {
  return ['dragswitch.js', './bower_components/jquery-dragify/jquery.dragify.js']
}
