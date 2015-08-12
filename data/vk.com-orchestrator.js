/**
 * MediaKeys namespace.
 */
MediaKeys.Init = function(undefined)
{
    self.port.on("MediaPlayPause", function() {
        unsafeWindow.headPlayPause(null);
	});

	self.port.on("MediaTrackNext", function() {
        unsafeWindow.audioPlayer.nextTrack();
    });

    self.port.on("MediaTrackPrevious", function() {
        unsafeWindow.audioPlayer.prevTrack();
	});
};

MediaKeys.Init(); 