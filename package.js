var packager = require('electron-packager');
var spawn = require('child_process').spawn;

console.log('Running npm install...');
var isWin = /^win/.test(process.platform);
var npmProc = spawn(isWin ? 'npm.cmd' : 'npm', ['install'], { cwd: path.resolve(PLAYER_DIR) });

npmProc.stdout.on('data', function(data) {
  console.log(data.toString());
});

npmProc.stderr.on('data', function(data) {
  console.error(data.toString());
});

console.log('Running npm install for player/');
var npmPlayerProc = spawn('./installPlayer.sh');

npmPlayerProc.stdout.on('data', function(data) {
  console.log(data.toString());
});

npmPlayerProc.stderr.on('data', function(data) {
  console.error(data.toString());
});

var procFinished = [false, false];

npmProc.on('close', function(code) {
  console.log('npm install exited with code ' + code);
  procFinished[0] = true;
  if(procFinished[0] && procFinished[1]) procsFinished();
});
npmPlayerProc.on('close', function(code) {
  console.log('npm install for player/ exited with code ' + code);
  procFinished[1] = true;
  if(procFinished[0] && procFinished[1]) procsFinished();
});

function procsFinished() {
  console.log('Creating electron package cache...');

  packager({dir: PLAYER_DIR, all: true, out: CACHE_DIR}, function(error, paths) {
    if(error) {
      console.log('Packager error: ' + error)
      throw error;
    }
    paths.forEach(function(apppath) {
      console.log('  - packaged ' + apppath);
    });
  });
}
