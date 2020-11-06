'use strict'

// TODO: notify new user has connected/disconnected to already connected users in chat
// TODO: format user messages to be able to distinguish user messages

// formatting message sent from user - 'User: Message'
// socket.on('chat-message', function(data) {
//   appendMessage(`${data.name}: ${data.message}`);
// });

// append message to container if user connected
// socket.on('user-connected', function(userName) {
//   appendMessage(`${userName} connected`);
// });

// append message to container if user disconnected
// socket.on('user-disconnected', function(userName) {
//   appendMessage(`${userName} disconnected`);
// });

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

// placeholder for data channel
var dataChannel = null;

// grabbing HTML DOM elements
const messageContainer = document.querySelector("#message-container");
const messageForm = document.querySelector("#message-form");
const messageInput = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");

// immediately prompts user for a user name to enter chat
const userName = prompt("Please enter user name:");

// appends message 'You have joined the room' to message container
appendMessage(messageContainer, `${userName} has joined the room.`, 'self');

// append message function
// appends message to new message element
// new message element is then appended to the message container
function appendMessage(container, message, user) {
  const messageElement = document.createElement("li");
  const messageNode = document.createTextNode(message);
  messageElement.className = user;
  messageElement.appendChild(messageNode);
  container.appendChild(messageElement);
  if (messageContainer.scrollTo) {
    messageContainer.scrollTo({
      top: messageContainer.scrollHeight,
      behavior: 'smooth'
    });
  } else {
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }
};

function addDataChannelEventListeners(datachannel) {
  datachannel.onmessage = function(event) {
    appendMessage(messageContainer, `${event.userName}: ${event.data}`, 'peer');
  }
  datachannel.onopen = function() {
    // enabling message input and send button
    sendButton.disabled = false;
    messageInput.disabled = false;
  }
  datachannel.onclose = function() {
    // disabling message input and send button
    sendButton.disabled = true;
    messageInput.disabled = true;
  }
  // appends messageinput value to message
  messageForm.addEventListener('submit', function(event) {
    event.preventDefault();
    const message = messageInput.value;
    appendMessage(messageContainer, `You: ${message}`, 'self');
    datachannel.send(message);
    messageInput.value = "";
  });
}

// polite 'peer' will open data channel when peerconnection has 'connected'
pc.onconnectionstatechange = function(event) {
  if (pc.connectionState == 'connected') {
    if (clientIs.polite) {
      dataChannel = pc.createDataChannel('text chat');
      addDataChannelEventListeners(dataChannel);
    }
  }
}

// fires on receiving end of data channel connection
// listen for the data channel on peer connection
pc.ondatachannel = function(event) {
  dataChannel = event.channel;
  addDataChannelEventListeners(dataChannel);
}

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
  const chatPanel = document.querySelector('#chat-panel');
  const winnerLabel = document.querySelector('#endgame');
  const replayBtn = document.querySelector('#replay-btn');
  const chatPopout = document.querySelector('#chat-open');
  var landingTiles = new Map();
  var vacantTiles = new Map();
  var gameplay;
  setGameplay();
  setupBoard();
  isMobileView();

  function setGameplay() {
    gameplay = [['-', '-', '-', '-', '-', '-', '-'], // A1 = gameplay[0[0]]
    ['-', '-', '-', '-', '-', '-', '-'], // B1 = gameplay[1[0]]
    ['-', '-', '-', '-', '-', '-', '-'],
    ['-', '-', '-', '-', '-', '-', '-'],
    ['-', '-', '-', '-', '-', '-', '-'],
    ['-', '-', '-', '-', '-', '-', '-']];
  }

  function setupBoard() {
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
  } // end of setup

  window.onresize = isMobileView;

  function isMobileView() {
    if (window.screen.width <= 800) {
      chatPanel.parentNode.removeChild(chatPanel);
      var overlay = document.querySelector('#overlay');
      overlay.append(chatPanel);
    }
    if (window.screen.width > 800) {
      chatPanel.parentNode.removeChild(chatPanel);
      var call = document.querySelector('#call');
      call.append(chatPanel);
    }
  }

  // REPLAY button is clicked, reset everything
  replayBtn.addEventListener('click', function(event) {
    while (gameboard.firstChild) {
      gameboard.removeChild(gameboard.firstChild);
    }
    winnerLabel.classList.remove('visible');
    setGameplay();
    setupBoard();
  })

  // CHAT open btn is clicked
  chatPopout.addEventListener('click', function(event) {
    toggleCard();
  });

  function toggleCard() {
    var card = document.querySelector('#overlay');
    card.classList.toggle('visible');
    var page = document.querySelector('body');
    page.classList.toggle('disable-scroll');
  }

  // if the customize-overlay is on display,
  // play this js
  if (document.querySelector('#overlay')) {
    var overlay = document.querySelector('#overlay');
    // if there are any clicks happening on overlay
    // check if it's from outside the form-card
    overlay.addEventListener('click',function(event){
      // Select the necessary elements from the DOM
      var areaClicked = event.target;
      console.log(areaClicked);
      if (areaClicked == overlay) {
        toggleCard();
      }
    });
  }


  // these happen when someone selects a column
  function selectColumn(col) {
    var selectedTile = landingTiles.get(col);
    selectedTile.firstChild.classList.add('tiled');
    updateGameplay(selectedTile);
    checkWin();
    // remove last tile on the vacantTiles
    // assign last tile as the landingTile
    landingTiles.set(col, vacantTiles.get(col).pop());
  }

  // update gameplay[][] with player marker
  function updateGameplay(selectedTile) {
      const colMap = new Map([['A',0], ['B',1], ['C',2], ['D',3], ['E',4], ['F',5], ['G',6]]);
      let tileId = selectedTile.id;
      let row = parseInt(tileId.charAt(1));
      let col = colMap.get(tileId.charAt(0));
      gameplay[row][col] = 'x';
  }

  function cueWin() {
    console.log('ya win');
    var cols = document.querySelectorAll('#gameboard > ul');
    cols.forEach((col, i) => {
      col.removeEventListener('click', function(event){ // remove clickeroo
        selectColumn(event.currentTarget.id);
      });
    });
    winnerLabel.classList.add('visible');
  }

  function checkWin() {
    var didWin = false;
    for (let row = 5; row >= 0; row--) { // loop rows bottom to up
      // if this row has no occupied tiles, skip it
      if (didWin) { break; }

      if (!gameplay[row].includes('x')) { // && !gameplay[row].includes('o')
        continue;
      }

      for (let col = 0; col <= 6; col++) { // loop through columns
        if (gameplay[row][col] == "x"){
          if (checkNeighbors(row, col)) {
            didWin = true;
            break;
          }
        }
      } // end of col loop
    } // end of row loop
  } // end of checkWin


  function checkNeighbors(row, col) {
    let count = 1;
    if (checkUp(row, col, count) ||
        checkUpRight(row, col, count) ||
        checkRight(row, col, count) ||
        checkDownRight(row, col, count)) {
          cueWin();
          return true;
    }
    return false;
  } // end of checkNeighbors()

  function checkToContinue(row, col, count) {
    if (count == 4) {
      console.log("the count is 4! T_T");
      return true;
    }
    if (row < 0 || row > 5 || col < 0 || col > 6) {
      return false;
    }
    return null;
  }

  function checkUp(row, col, count) {
    let me = gameplay[row][col];
    row = row - 1;
    let willContinue = checkToContinue(row, col, count);
    while (willContinue === null) {
      let neighbor = gameplay[row][col];
      if (neighbor != me) {
        break;
      }
      count += 1;
      row = row - 1;
      willContinue = checkToContinue(row, col, count);
    }
    return willContinue;
  }

  function checkUpRight(row, col, count) {
    let me = gameplay[row][col];
    row = row - 1;
    col = col + 1;
    let willContinue = checkToContinue(row, col, count);
    while (willContinue === null){
      let neighbor = gameplay[row][col];
      if (neighbor != me) {
        break;
      }
      count += 1;
      row = row - 1;
      col = col + 1;
      willContinue = checkToContinue(row, col, count);
    }
    return willContinue;
  }

  function checkRight(row, col, count) {
    let me = gameplay[row][col];
    col = col + 1;
    let willContinue = checkToContinue(row, col, count);
    while (willContinue === null) {
      let neighbor = gameplay[row][col];
      if (neighbor != me) {
        break;
      }
      count += 1;
      col = col + 1;
      willContinue = checkToContinue(row, col, count);
    }
    return willContinue;
  }

  function checkDownRight(row, col, count) {
    let me = gameplay[row][col];
    row = row + 1;
    col = col + 1;
    let willContinue = checkToContinue(row, col, count);
    while (willContinue === null) {
      let neighbor = gameplay[row][col];
      if (neighbor != me) {
        break;
      }
      count += 1;
      row = row + 1;
      col = col + 1;
      willContinue = checkToContinue(row, col, count);
    }
    return willContinue;
  }

}; // end of IIFE

videoGame();
