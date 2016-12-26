var fs = require('fs-extra');
var http = require('http');
var express = require('express');
var MATUProjectBackup = require('./matu-project-backup.js');
var packager = require('electron-packager');
var archiver = require('archiver');
var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get(/\/\d+/, function(request, response) {
  var PATH = request.path.replace(/\//, '');
  console.log('***********Packaging ' + PATH);

  // copy the player to a temp folder
  console.log('- emptying tmp directory');
  fs.emptydirSync('tmp');
  console.log('- copying player to tmp')
  fs.copySync('player', 'tmp');

  console.log('- downloading ZIP to file');
  MATUProjectBackup(PATH,function() {
    console.log('- packaging as app:');
    packager({dir: 'tmp', arch: 'all', out: 'tmp/out'}, function(error, paths) {

      paths.forEach(function(apppath) {
        console.log('  - packaged ' + apppath);
      });

      // create a file to stream archive data to.
      var outname = '/tmp/archived.zip';
      console.log('- writing to archive ' + outname);
      var output = fs.createWriteStream(outname);
      var archive = archiver('zip', { store: true });

      // good practice to catch this error explicitly
      archive.on('error', function(err) {
        console.log('ERROR: archive threw error ' + err);
      });
      archive.pipe(output);

      // append files
      archive.directory('tmp/out', 'photron-' + PATH);

      // finalize the archive (ie we are done appending files but streams have to finish yet)
      archive.finalize();

      output.on('close', function() {
        console.log('- archive finalized, ' + archive.pointer() + ' total bytes');

        // send the file to user
        console.log('- sending file to client')
        var file = fs.readFileSync(outname, 'binary');
        response.setHeader('Content-disposition', 'attachment; filename=photron-' + PATH + '.zip');
        response.setHeader('Content-Length', file.length);
        response.setHeader('Content-type', 'application/zip');
        response.write(file, 'binary');
        response.end();

        // empty the tmp directory
        console.log('- emptying tmp directory');
        fs.emptydirSync('tmp');
      });
    });
  });
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
