var JSZip = require('jszip');
var fs = require('fs');
var http = require('https');

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

			project = JSON.parse(string);
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
	});
}

function downloadCostume(callback){
	if(costumesToDownload.length > 0){
		var current = costumesToDownload.pop();
		logMessage("Loading asset "+current.costumeName+" ("+completeAssets+"/"+totalAssets+")");
		var string = ''
		http.get("https://cdn.assets.scratch.mit.edu/internalapi/asset/"+current.baseLayerMD5+"/get/", function(response){
				response.on('data', function(data){
		      string += data;
			  });
		    response.on('end', function(){
					var ext = current.baseLayerMD5.match(/\.[a-zA-Z0-9]+/)[0];
					jszip.file(current.baseLayerID+ext, string, {binary: true});
					completeAssets++;
					setProgress(10+89*(completeAssets/totalAssets));
					downloadCostume(callback);
				});
		});
	} else {
		downloadSound(callback);
	}
}

function downloadSound(callback){
	if(soundsToDownload.length > 0){
		var current = soundsToDownload.pop();
		logMessage("Loading asset "+current.soundName+" ("+completeAssets+"/"+totalAssets+")");
		var string = '';
		http.get("https://cdn.assets.scratch.mit.edu/internalapi/asset/"+current.md5+"/get/", function(response){
			response.on('data', function(data){
				string += data;
			});
			response.on('end', function(){
				var ext = current.md5.match(/\.[a-zA-Z0-9]+/)[0];
				jszip.file(current.soundID+ext, string, {binary: true});
				completeAssets++;
				setProgress(10+89*(completeAssets/totalAssets));
				downloadSound(callback);
			});
		});
	} else {
		logMessage("Generating ZIP...");
		var content = jszip.generate({base64:false,compression:'DEFLATE'});
		logMessage("Saving...");
		fs.writeFileSync('tmp/project.zip', content, 'binary');

		psuccess(callback);
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

function perror(){
	logMessage("Download error");
	setProgress(100);
}

function psuccess(callback){
	logMessage("Finished!");
	if (callback) callback();
}

function setProgress(perc){
}

function reset(){
}

function logMessage(msg){
	console.log("  - " + msg);
}

module.exports = startDownload;
