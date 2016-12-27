var JSZip = require('jszip');
var fs = require('fs');
var http = require('https');
var os = require('os');
var crypto = require('crypto');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

var maxWidth = 0;
var jszip = null;
var project = null;
var id = null;
var soundId = 0;
var costumeId = 0;
var soundsToDownload = [];
var costumesToDownload = [];
var totalAssets = 0;
var completeAssets = 0;

function startDownload(projectId, callback){
	logMessage("Downloading project: "+projectId);
	soundId = 0;
	costumeId = 0;
	totalAssets = 0;
	completeAssets = 0;
	soundsToDownload = [];
  costumesToDownload = [];
	id = projectId;
	setProgress(0);
	jszip = new JSZip();
	jszip.comment = "Created with MegaApuTurkUltra's Project Downloader";
	var string = '';
	http.get("https://cdn.projects.scratch.mit.edu/internalapi/project/"+projectId+"/get/", function(response){

    response.on('data', function(data){
      string += data;
	  });
    response.on('end', function(){
			setProgress(10);
			logMessage("Loaded JSON");

      try {
        project = JSON.parse(string);
      } catch(e) {
        perror(e, callback);
        return;
      }
			processSoundsAndCostumes(project);
			if(project.hasOwnProperty("children")){
				for(child in project.children){
					processSoundsAndCostumes(project.children[child]);
				}
			}
			logMessage("Found "+totalAssets+" assets");
			jszip.file("project.json", JSON.stringify(project));
			downloadCostume(callback);
    });
    response.on('error', (e) => {
      perror(e, callback);
    });
	}).on('error', (e) => {
    perror(e, callback);
  });
}

function downloadCostume(callback){
	if(costumesToDownload.length > 0){
		var current = costumesToDownload.pop();
		logMessage("Loading asset "+current.costumeName+" ("+completeAssets+"/"+totalAssets+")");
		var parts = [];
		http.get("https://cdn.assets.scratch.mit.edu/internalapi/asset/"+current.baseLayerMD5+"/get/", function(response){
				response.on('data', function(data){
		      parts.push(data);
			  });
		    response.on('end', function(){
					var ext = current.baseLayerMD5.match(/\.[a-zA-Z0-9]+/)[0];
					jszip.file(current.baseLayerID+ext, Buffer.concat(parts), {binary: true});
					completeAssets++;
					setProgress(10+89*(completeAssets/totalAssets));
					downloadCostume(callback);
				});
        response.on('error', (e) => {
          perror(e, callback);
        });
		}).on('error', (e) => {
      perror(e, callback);
    });
	} else {
		downloadSound(callback);
	}
}

function hasFffmpeg() {
  try {
    var isWin = /^win/.test(process.platform);
    spawn(isWin ? 'ffprobe.exe' : 'ffprobe', ['-version']);
    return true;
  } catch(e) {
    return false;
  }
}

function downloadSound(callback){
	if(soundsToDownload.length > 0){
		var current = soundsToDownload.pop();
		logMessage("Loading asset "+current.soundName+" ("+completeAssets+"/"+totalAssets+")");
		var parts = [];
		http.get("https://cdn.assets.scratch.mit.edu/internalapi/asset/"+current.md5+"/get/", function(response){
			response.on('data', function(data){
				parts.push(data);
			});
			response.on('end', function(){
				var ext = current.md5.match(/\.[a-zA-Z0-9]+/)[0];
        
        var soundFile = Buffer.concat(parts);
        
        function done(buffer) {
          jszip.file(current.soundID+ext, buffer, {binary: true});
          completeAssets++;
          setProgress(10+89*(completeAssets/totalAssets));
          downloadSound(callback);
        }
        
        if(!hasFffmpeg) {
          done(soundFile);
        } else {
          // check if it's adpcm
          var tmpdir = os.tmpdir();
          var inputFile = tmpdir + '/photron'+crypto.randomBytes(4).readUInt32LE(0) + '.something';
          var outputFile = tmpdir + '/photron'+crypto.randomBytes(4).readUInt32LE(0) + '.wav';
          
          function cleanup() {
            try {
              fs.unlinkSync(inputFile);
              fs.unlinkSync(outputFile);
            } catch(e) {
              // don't care
            }
          }
          
          fs.writeFileSync(inputFile, soundFile);
          exec('ffprobe ' + inputFile, function(error, stdout, stderr) {
            if (error) {
              // oh well
              done(soundFile);
              cleanup();
              return;
            }
            console.log(`ffprobe out: ${stdout}`);
            console.log(`ffprobe err: ${stderr}`);
            if(stdout.match(/adpcm/) != null || stderr.match(/adpcm/) != null) {
              console.log('Converting adpcm to pcm');
              // convert to pcm so phosphorus can play it
              exec(`ffmpeg -i ${inputFile} ${outputFile}`, function(error, stdout, stderr) {
                if (error) {
                  // oh well
                  done(soundFile);
                  cleanup();
                  return;
                }
                console.log(`ffmpeg out: ${stdout}`);
                console.log(`ffmpeg err: ${stderr}`);
                
                if(fs.existsSync(outputFile)) {
                  done(fs.readFileSync(outputFile));
                } else {
                  done(soundFile);
                }
                cleanup();
              });
            } else {
              done(soundFile);
              cleanup();
            }
          });
        }
        
				
			});
      response.on('error', (e) => {
        perror(e, callback);
      });
		}).on('error', (e) => {
      perror(e, callback);
    });
	} else {
		logMessage("Generating ZIP...");
    jszip.generateAsync({streamFiles:true,compression:'DEFLATE',type:'nodebuffer'}).then(function(file) {
      psuccess(file, callback);
    }).catch(function(err) {
      perror(err, callback);
    });
	}
}

function processSoundsAndCostumes(node){
	if(node.hasOwnProperty("costumes")){
		for(var i=0;i<node.costumes.length;i++){
			var current = node.costumes[i];
			current.baseLayerID = costumeId;
			costumeId++;
			totalAssets++;
			costumesToDownload.push(current);
		}
	}
	if(node.hasOwnProperty("sounds")){
		for(var i=0;i<node.sounds.length;i++){
			var current = node.sounds[i];
			current.soundID = soundId;
			soundId++;
			totalAssets++;
			soundsToDownload.push(current);
		}
	}
}

function perror(err, callback){
	logMessage("Download error");
	setProgress(100);
  if(callback) callback(err, null);
}

function psuccess(file, callback){
	logMessage("Finished!");
	if (callback) callback(null, file);
}

function setProgress(perc){
}

function reset(){
}

function logMessage(msg){
	console.log("  - " + msg);
}

module.exports = startDownload;
