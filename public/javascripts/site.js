'use strict'

// location of where the socket will be hosted
const socket = io('http://localhost:3000');
// grabbing HTML element IDs
const messageContainer = document.querySelector("#message-container")
const messageForm = document.querySelector("#message-form");
const messageInput = document.querySelector("#message-input");
// immediately prompts user for a user name to enter chat
const userName = prompt("Please enter user name");
// appends message 'You joined' to container
appendMessage("You joined");
// sends this message to server indicating user has joined
socket.emit('new-user', userName);

// formatting message sent from user - 'User: Message'
socket.on('chat-message', function(data) {
  appendMessage(`${data.name}: ${data.message}`);
});

// append message to container if user connected
socket.on('user-connected', function(userName) {
  appendMessage(`${userName} connected`);
});

// append message to container if user disconnected
socket.on('user-disconnected', function(userName) {
  appendMessage(`${userName} disconnected`);
});

// appends messageinput value to message and emits to server as 'You'
messageForm.addEventListener('submit', function(event) {
  event.preventDefault();
  const message = messageInput.value;
  appendMessage(`You: ${message}`);
  socket.emit('send-chat-message', message);
  messageInput.value = "";
});

// append message function 
// appends message to new div message element 
// new div message element is then appended to the message container
function appendMessage(message) {
  const messageElement = document.createElement("li");
  messageElement.innerText = message;
  messageContainer.prepend(messageElement);
};

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
};

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

// function to start stream when allowed
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
};

// listening to attach peer tracks
pc.ontrack = function(track) {
  peerStream.addTrack(track.track);
};

// select call button and create click event on button
var callButton = document.querySelector("#call-button");
callButton.addEventListener('click', startCall);

// function to start call when button is clicked
function startCall() {
  console.log("Connection: Caller");
  callButton.hidden = true;
  clientIs.polite = true;
  sc.emit("calling");
  startStream();
};

// handling receiving connection
sc.on('calling', function() {
  console.log("Connection: Receiver");
  callButton.innerText = "Answer Call";
  callButton.id = "answer-button";
  callButton.removeEventListener('click', startCall);
  callButton.addEventListener('click', function() {
    callButton.hidden = true;
    startStream();
  });
});

(function () {

  // automates gameboard creation
  const gameboard = document.querySelector('#gameboard');
  for (var i = 0; i <=6; i++) {
    let newRow = document.createElement('ul');
    newRow.id = 'col_' + i;
    for (var j = 0; j <=5; j++) {
        let newCell = document.createElement('li');
        newCell.classList.add('tile');
        newCell.innerText = 'hi';
        newRow.append(newCell);
    }
    gameboard.append(newRow);
  }

})(); // end of IIFE
