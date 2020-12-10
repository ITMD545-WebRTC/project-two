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
  polite: false,
  settingRemoteAnswerPending: false
};

// setting up google STUN servers
var rtcConfig = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302'
      ]
    }
  ]
};

// pc = peer connection
var pc = new RTCPeerConnection(rtcConfig);

// placeholder for data channel
var dataChannel = null;
var dc = null;

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
    appendMessage(messageContainer, `${event.data}`, 'peer');
  }
  dataChannel.onopen = function() {
    // enabling message input and send button
    sendButton.disabled = false;
    messageInput.disabled = false;
  }
  dataChannel.onclose = function() {
    // disabling message input and send button
    sendButton.disabled = true;
    messageInput.disabled = true;
  }
  // appends messageinput value to message
  messageForm.addEventListener('submit', function(event) {
    event.preventDefault();
    const message = messageInput.value;
    appendMessage(messageContainer, `${message}`, 'self');
    datachannel.send(message);
    messageInput.value = "";
  });
}

//Recieved data from peer
function addDCEventListeners(dc) {
  dc.onmessage = function(event) {
    console.log("See peer moves: ");
    console.log(`${event.data}`);
    // updates gameplay accdg to opponent's move
    videoGame.selectColumn(event.data, false);
  }
}

// polite 'peer' will open data channel when peerconnection has 'connected'
pc.onconnectionstatechange = function(event) {
  if (pc.connectionState == 'connected') {
    if (clientIs.polite) {
      dataChannel = pc.createDataChannel('text chat');
      addDataChannelEventListeners(dataChannel);
      dc = pc.createDataChannel('gameChannel');
      addDCEventListeners(dc);
    }
  }
}

// fires on receiving end of data channel connection
// listen for the data channel on peer connection
pc.ondatachannel = function(event) {
  if(event.channel.label == 'text chat'){
  dataChannel = event.channel;
  addDataChannelEventListeners(dataChannel);
  } else if (event.channel.label == 'gameChannel') {
    dc = event.channel;
    addDCEventListeners(dc);
  }
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
  videoGame.setUserAsPlayer(1);
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
  videoGame.setUserAsPlayer(2);
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
      // var offerCollision = (description.type == 'offer') &&
      //                      (clientIs.makingOffer || pc.signalingState != 'stable')
      // clientIs.ignoringOffer = !clientIs.polite && offerCollision;

      var readyForOffer = !clientIs.makingOffer &&
                          (pc.signalingState == "stable" || clientIs.settingRemoteAnswerPending);
      var offerCollision = description.type == "offer" && !readyForOffer;
      clientIs.ignoringOffer = !clientIs.polite && offerCollision;

      if (clientIs.ignoringOffer) {
        return; // Just leave if we're ignoring offers
      }

      // Set the remote description
      try {
        console.log("Setting a remote description:", description);
        clientIs.settingRemoteAnswerPending = description.type == "answer";
        await pc.setRemoteDescription(description);
        clientIs.settingRemoteAnswerPending = false;
      } catch(error) {
        console.error("Error setting local description:", error);
      }

      // if its an offer, we need to answer it
      if (description.type == 'offer') {
        console.log('Specifically, an offer description');
          try {
            // Very latest browsers are ok with an
            // argument-less call to setLocalDescription:
            await pc.setLocalDescription();
          } catch (error) {
            // Older browsers are NOT ok. So because we're handling an
            // offer, we need to prepare an answer:
            console.log("Falling back to older setLocalDescription");
            if (pc.signalingState == 'have-remote-offer') {
              // create answer if necessary
              console.log("Attempting to prepare answer:");
              var offer = await pc.createAnswer();
            } else {
              // else, create offer
              console.log("Attempting to prepare offer:");
              var offer = await pc.createOffer();
            }
            // await pc.setLocalDescription(new RTCSessionDescription(answer));
            await pc.setLocalDescription(offer);
          } finally {
            console.log("Sending a response:", pc.localDescription);
              sc.emit('signal', { description: pc.localDescription });
          }
      }

    } else if (candidate) {
      console.log('Recieved a candidate');
      console.log(candidate);
      // Save Safari and other browsers that can't handle an
      // empty string for the `candidate.candidate` value:
      try {
        if (candidate.candidate.length > 1) {
          await pc.addIceCandidate(candidate);
        }
      } catch (error) {
        if (!clientIs.ignoringOffer) {
          throw error;
        }
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
  var gameplay; // 2d array of game progress

  var player = {
    turn: 0,
    canFire: false,
    color: null,
    opp: null,
    marker: null
  };

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
        bottomTile.firstChild.classList.add('imagine-' + player.color);
      });

      newCol.addEventListener('mouseout', function(event){ // hover out
        let bottomTile = landingTiles.get(event.currentTarget.id);
        bottomTile.firstChild.classList.remove('imagine-' + player.color);
      });

      newCol.addEventListener('click', function(event){ // clickeroo
        // selectColumn(event.currentTarget.id);
        if (player.canFire){
          videoGame.selectColumn(event.currentTarget.id, true);
          dc.send(event.currentTarget.id);
          return;
        }
      });
    }) // end of forEach (A-G)
  } // end of setup

  videoGame.setUserAsPlayer = function setUserAsPlayer(playerTurn) {
    if (playerTurn == 1) {
      player.turn = 1;
      player.canFire = true;
      player.color = 'red';
      player.opp = 'o';
      player.marker = 'x';
      return;
    } if (playerTurn == 2) {
      player.turn = 2;
      player.canFire = false;
      player.color = 'yellow';
      player.opp = 'x';
      player.marker = 'o';
      return;
    }
  };

  window.onresize = isMobileView;

  function isMobileView() {
    if (window.innerWidth <= 800) {
      chatPanel.parentNode.removeChild(chatPanel);
      var overlay = document.querySelector('#overlay');
      overlay.append(chatPanel);
    }
    if (window.innerWidth > 800) {
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
  videoGame.selectColumn = function selectColumn(col, isSelf) {
    var marker = isSelf ? player.marker : player.opp;
    var color = marker == 'x' ? 'red' : 'yellow';
    var selectedTile = landingTiles.get(col);
    selectedTile.firstChild.classList.add('tiled-' + color);
    updateGameplay(selectedTile, marker);
    checkWin(marker);
    // remove last tile on the vacantTiles, assign last tile as the landingTile
    landingTiles.set(col, vacantTiles.get(col).pop());
    player.canFire = color == player.color ? false:true;
  }

  // update gameplay[][] with player marker
  function updateGameplay(selectedTile, marker) {
      const colMap = new Map([['A',0], ['B',1], ['C',2], ['D',3], ['E',4], ['F',5], ['G',6]]);
      let tileId = selectedTile.id;
      let row = parseInt(tileId.charAt(1));
      let col = colMap.get(tileId.charAt(0));
      gameplay[row][col] = marker; // player1: x, player2: o
  }

  function cueWin(marker) {
    console.log('ya win');
    var cols = document.querySelectorAll('#gameboard > ul');
    var message = document.querySelector('#winner-label');
    cols.forEach((col, i) => {
      col.removeEventListener('click', function(event){ // remove clickeroo
        selectColumn(event.currentTarget.id, true);
      });
    }); // TODO: Gotta fix this
    if (marker != player.marker) {
      message.innerHTML = "Ya did pretty good. Wanna try again?";
    }
    winnerLabel.classList.add('visible');
  }

  function checkWin(marker) {
    var didWin = false;
    for (let row = 5; row >= 0; row--) { // loop rows bottom to up
      // if this row has no occupied tiles, skip it
      if (didWin) { break; }

      if (!gameplay[row].includes(marker)) {
        continue;
      }

      for (let col = 0; col <= 6; col++) { // loop through columns
        if (gameplay[row][col] == marker){
          if (checkNeighbors(row, col)) {
            cueWin(marker);
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
