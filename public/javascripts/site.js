'use strict'

// namespace --> signaling channel (sc)
var sc = io.connect('/' + NAMESPACE);

sc.on('message', function(data) {
  console.log('Message received: ' + data);
});

// tracking client states
var clientIs = {
  makingOffer: false,
  ignoringOffer: false,
  // has opposite 'impolite' 
  // impolite makes connection accept offer regardless
  // only one side of connection needs to be polite
  // polite accepts offer even though it may already have one
  polite: false
}

// eventual setup of STUN servers
var rtcConfig = null;
// pc = peer connection
var pc = new RTCPeerConnection(rtcConfig);

// handle video streams
// setting media constraints for video and audio
var mediaConstraints = {
  video: true,
  audio: false
};

// handle self video
var selfVideo = document.querySelector('#self-video');
var selfStream = new MediaStream();
// setting self video source object to empty self stream
selfVideo.srcObject = selfStream;

// handle peer video
var peerVideo = document.querySelector('#peer-video');
var peerStream = new MediaStream();
// setting peer video source object to empty peer stream
peerVideo.srcObject = peerStream;

async function startStream() {
  try {
    var stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    for (var track of stream.getTracks()) {
      pc.addTrack(track);
    };
    selfVideo.srcObject = stream;
  } catch (error) {
    console.error(error);
  }
}

// listening to attach peer tracks
pc.ontrack = function(track) {
  peerStream.addTrack(track.track);
}