var pageWorkers = [];
var activePageWorkerIndex = -1;
var hotkeyWorker = null;
var { setTimeout } = require("sdk/timers");

var RegisterFirefoxHotkeys = function () {
	aHotkeyWorker = require("./firefoxHotkeys");
	aHotkeyWorker.addEventListener(EmitEventToActivePageWorker);
	aHotkeyWorker.postMessage("attach");
};

var RegisterHotkeys = function()
{
	var system = require("sdk/system");
	var aHotkeyWorker;

	switch (system.platform)
	{
		case "winnt":
			console.log("Registering global hotkeys");
			var {Cu} = require("chrome");
			var {ChromeWorker} = Cu.import("resource://gre/modules/Services.jsm", null);
			aHotkeyWorker = new ChromeWorker(require("sdk/self").data.url("windowsHotkeys.js"));
			aHotkeyWorker.addEventListener("message", EmitEventToActivePageWorker);
			aHotkeyWorker.postMessage("attach");
			break;
		case "linux":
			console.log("Registering DBus hotkeys");
			aHotkeyWorker = require("./linuxDBusHotkeys");
			aHotkeyWorker.addEventListener(EmitEventToActivePageWorker);
			if (aHotkeyWorker.gLibsExist) {
				aHotkeyWorker.postMessage("attach");
				break;
 			} else {
				console.log("DBus not supported. glib, gobject and gio libaries are required.");
 			}
		default:
			console.log("Global hotkeys not supported for " + system.platform + ". Falling back to browser hotkeys");
			RegisterFirefoxHotkeys();
	}

};

var UnregisterHotkeys = function(){
    if (hotkeyWorker != null){
        hotkeyWorker.postMessage("detach");
        console.log("Unregistered hotkeys");
    }
};

var RegisterContentScripts = function(pageDomains)
{
	var pageMod = require("sdk/page-mod");
	var { data } = require("sdk/self");
	var contentScriptFiles;
	var contentScriptOptions = {};
	
	for(let pageDomain of pageDomains)
	{
		if (pageDomain == "youtube.com"){
			contentScriptFiles = "./youtube.com-orchestrator.js";
			contentScriptOptions.pageScript = data.url("./youtube.com-orchestrator-pageScript.js");
		}
		else if (pageDomain == "vk.com"){
			contentScriptFiles = "./vk.com-orchestrator.js";
		}
		else contentScriptFiles = ["./Finder.js", "./" + pageDomain + "-view.js", "./orchestrator.js"];

		pageMod.PageMod(
		{
			include: "*." + pageDomain,
			contentScriptFile: contentScriptFiles,
			contentScriptOptions: contentScriptOptions,
			attachTo: ["top", "existing"],
			onAttach: AttachWorkerToPage
		});
	}
};

var AttachWorkerToPage = function(worker)
{
	pageWorkers.push(worker);
	activePageWorkerIndex = pageWorkers.indexOf(worker);

	worker.on('detach', function() {
		DetachPageWorker(this, pageWorkers); //might be worker rather than 'this'
	});
	worker.tab.on('activate', function(){
		var system = require("sdk/system");
		if (system.platform === "linux" && hotkeyWorker && hotkeyWorker.gLibsExist) {
			hotkeyWorker.postMessage('reattach');
		}
		ActivatePageWorker(worker);
	});
	
	if (hotkeyWorker == null) RegisterHotkeys();
};

var ActivatePageWorker = function(worker)
{
	//only act if the array has more than one element
	if (activePageWorkerIndex > 0)
	{
		var indexOfWorker = pageWorkers.indexOf(worker);
		if (indexOfWorker != activePageWorkerIndex)
		{
			//console.log("switching from " + pageWorkers[activePageWorkerIndex].url + " to " + pageWorkers[indexOfWorker].url);
			pageWorkers.splice(indexOfWorker, 1);
			pageWorkers.push(worker);
		}
	}
};

//Use this to detach message worker when the media page is closed
var DetachPageWorker = function(worker, workerArray)
{
	var indexOfWorker = workerArray.indexOf(worker);
	if(indexOfWorker == -1) return;
	
	workerArray.splice(indexOfWorker, 1);
	activePageWorkerIndex = activePageWorkerIndex - 1;
	
	setTimeout(function(){
		if (activePageWorkerIndex == -1 && hotkeyWorker != null)
		{
			hotkeyWorker.postMessage("detach");
			hotkeyWorker.removeEventListener("message", EmitEventToActivePageWorker);
			hotkeyWorker = null;
		}
	}, 5000);
};

var EmitEventToActivePageWorker = function(event)
{
	if (event.data == "attach failed") RegisterFirefoxHotkeys();
	//console.log("Sending " + event.data + " to " + pageWorkers[activePageWorkerIndex].tab.url);
	pageWorkers[activePageWorkerIndex].port.emit(event.data);
};

exports.RegisterHotkeys = RegisterHotkeys;
exports.UnregisterHotkeys = UnregisterHotkeys;
exports.RegisterContentScripts = RegisterContentScripts;
exports.EmitEventToActivePageWorker = EmitEventToActivePageWorker;
