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
  negotiateConnection();
};

// handling receiving connection
sc.on('calling', function() {
  console.log("Connection: Receiver");
  negotiateConnection();

  callButton.innerText = "Answer Call";
  callButton.id = "answer-button";
  callButton.removeEventListener('click', startCall);
  callButton.addEventListener('click', function() {
    callButton.hidden = true;
    startStream();
  });
});

// Setting up the peer connection
async function negotiateConnection() {
  pc.onnegotiationneeded = async function() {
    try {
      console.log('Making an offer');
      clientIs.makingOffer = true;
      try {
        // Very latest browsers are ok with an
        // argument-less call to setLocalDescription:
        await pc.setLocalDescription();
      } catch (error) {
        // Older browsers are NOT ok. So because we're making an
        // offer, we need to prepare an offer:
        var offer = await pc.createOffer();
        await pc.setLocalDescription(new RTCSessionDescription(offer));
      } finally {
        sc.emit('signal', { description: pc.localDescription });
      }
    } catch (error) {
      console.error(error);
    } finally {
      clientIs.makingOffer = false;
    }
  }
}

// sc = signaling channel
sc.on('signal', async function({ candidate, description }) {
  try {
    if (description) {
      console.log('Recieved a description');
      var offerCollision = (description.type == 'offer') &&
                           (clientIs.makingOffer || pc.signalingState != 'stable')
      clientIs.ignoringOffer = !clientIs.polite && offerCollision;

      if (clientIs.ignoringOffer) {
        return; // Just leave if we're ignoring offers
      }

      // Set the remote description
      await pc.setRemoteDescription(description);

      // if its an offer, we need to answer it
      if (description.type == 'offer') {
        console.log('Specifically, an offer description');
          try {
            // Very latest browsers are ok with an
            // argument-less call to setLocalDescription:
            await pc.setLocalDescription();
          } catch (error) {
            // Older browsers are NOT ok. So because we're handling an
            // offer, we need to prepare ans answer:
            var answer = await pc.createAnswer();
            await pc.setLocalDescription(new RTCSessionDescription(answer));
          } finally {
              sc.emit('signal', { description: pc.localDescription});
          }
      }

    } else if (candidate) {
      console.log('Recieved a candidate');
      console.log(candidate);
      // Save Safari and other browsers that can't handle an
      // empty string for the `candidate.candidate` value:
      if (candidate.candidate.length > 1) {
        await pc.addIceCandidate(candidate);
      }
    }
  } catch (error) {
    console.error(error);
  }
});

// logic to send candidate
pc.onicecandidate = function({candidate}) {
  sc.emit('signal', { candidate: candidate});
}

function videoGame() {
  // declare arrays and maps to keep track of gameplay
  const gameboard = document.querySelector('#gameboard');
  var landingTiles = new Map();
  var vacantTiles = new Map();
  var gameplay = [['-', '-', '-', '-', '-', '-', '-'],
                  ['-', '-', '-', '-', '-', '-', '-'],
                  ['-', '-', '-', '-', '-', '-', '-'],
                  ['-', '-', '-', '-', '-', '-', '-'],
                  ['-', '-', '-', '-', '-', '-', '-'],
                  ['-', '-', '-', '-', '-', '-', '-']];

  // automates gameboard creation
  const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  // iterates from A - G
  columns.forEach((col, i) => {
    // create a column(ul) of tiles(li)
    let newCol = document.createElement('ul');
    newCol.id = col;

    // iterates for each row
    for (var j = 0; j <=5; j++) {
        let newCell = document.createElement('li');
        let circle = document.createElement('span');
        newCell.classList.add('tile');
        newCell.id = col + j;
        circle.innerText = ' ';
        circle.classList.add('circle');
        newCell.append(circle);
        newCol.append(newCell);
    }

    // add elements to gameplay trackers
    vacantTiles.set(col, [...newCol.children]);
    landingTiles.set(col, vacantTiles.get(col).pop());
    // add all tiles and columns on the page
    gameboard.append(newCol);

    // EVENT LISTENERS for each column
    newCol.addEventListener('mouseover', function(event){ // hover in
      let bottomTile = landingTiles.get(event.currentTarget.id);
      bottomTile.firstChild.classList.add('imaginer');
    });

    newCol.addEventListener('mouseout', function(event){ // hover out
      let bottomTile = landingTiles.get(event.currentTarget.id);
      bottomTile.firstChild.classList.remove('imaginer');
    });

    newCol.addEventListener('click', function(event){ // clickeroo
      selectColumn(event.currentTarget.id);
    });
  }) // end of forEach (A-G)

  // these happen when someone selects a column
  function selectColumn(col) {
    var selectedTile = landingTiles.get(col);
    selectedTile.firstChild.classList.add('tiled');
    // remove last tile on the vacantTiles
    // assign last tile as the landingTile
    landingTiles.set(col, vacantTiles.get(col).pop());
  }

}; // end of IIFE

videoGame();
