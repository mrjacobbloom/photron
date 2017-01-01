var fs = require('fs-extra');
var http = require('http');
var path = require('path');
var express = require('express');
var MATUProjectBackup = require('./matu-project-backup.js');
var archiver = require('archiver');

var CACHE_DIR = 'electron-cache';
var PLAYER_DIR = 'player';

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
  console.log('- versions: ' + JSON.stringify(request.query));

  console.log('- downloading project to ZIP');
  
  MATUProjectBackup(PATH, function(err, file) {
    function sendError() {
      response.status(500);
      response.setHeader('Content-type', 'text/html');
      response.end('<script>window.parent.photron_error()</script>');
    }
    
    if(err) {
      console.error(err);
      sendError();
      return;
    }
    
    var archive = archiver('zip', {});

    // good practice to catch this error explicitly
    archive.on('error', function(err) {
      console.error(err);
      sendError();
    });
    
    response.setHeader('Content-disposition', 'attachment; filename=photron-' + PATH + '.zip');
    response.setHeader('Content-type', 'application/zip');
    
    archive.pipe(response);
    response.on('finish', function() {
      console.log(' - Response sent');
    });

    // append files
    var basedir = 'photron-' + PATH;
    if(request.query.win32 == '') {
      console.log(' - win32');
      archive.directory(CACHE_DIR + '/photron-win32-ia32', basedir + '-win32-ia32');
      archive.append(file, { name: basedir + '-win32-ia32/resources/app/project.zip' });
    }
    if(request.query.win64 == '') {
      console.log(' - win64');
      archive.directory(CACHE_DIR + '/photron-win32-x64', basedir + '-win32-x64');
      archive.append(file, { name: basedir + '-win32-x64/resources/app/project.zip' });
    }
    if(request.query.linux32 == '') {
      console.log(' - linux32');
      archive.directory(CACHE_DIR + '/photron-linux-ia32', basedir + '-linux-ia32');
      archive.append(file, { name: basedir + '-linux-ia32/resources/app/project.zip' });
    }
    if(request.query.linux64 == '') {
      console.log(' - linux64');
      archive.directory(CACHE_DIR + '/photron-linux-x64', basedir + '-linux-x64');
      archive.append(file, { name: basedir + '-linux-x64/resources/app/project.zip' });
    }
    if(request.query.linuxarm == '') {
      console.log(' - linuxarm');
      archive.directory(CACHE_DIR + '/photron-linux-armv7l', basedir + '-linux-armv7l');
      archive.append(file, { name: basedir + '-linux-armv7l/resources/app/project.zip' });
    }
    if(request.query.mac64 == '') {
      console.log(' - mac64');
      archive.directory(CACHE_DIR + '/photron-darwin-x64', basedir + '-darwin-x64');
      archive.append(file, { name: basedir + '-darwin-x64/photron.app/Contents/Resources/app/project.zip' });
    }

    // finalize the archive (ie we are done appending files but streams have to finish yet)
    archive.finalize();
  });
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
