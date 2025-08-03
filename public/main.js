const socket = io("https://secure-p2p-share.onrender.com", { transports: ['websocket', 'polling'] });
let peerConn;
let dataChannel;

const chatSection = document.getElementById('chatSection');
const chatLog = document.getElementById('chatLog');
const msgInput = document.getElementById('msgInput');
const sendMsg = document.getElementById('sendMsg');
const fileInput = document.getElementById('fileInput');
const status = document.getElementById('status');

const nameInput = document.getElementById('nameInput');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');

let myName = "";

joinBtn.onclick = () => {
  myName = nameInput.value.trim();
  const room = roomInput.value.trim();

  if (!myName) {
    alert("Please enter your name");
    return;
  }
  if (!room) {
    alert("Please enter a room code");
    return;
  }

  socket.emit('join', room);
  initPeer(true);
  chatSection.style.display = 'flex';  // assuming chatSection is flex container
};


socket.on('peer-joined', () => {
  console.log("👥 Peer joined! Initializing connection...");
  initPeer(false)
});

socket.on('signal', async data => {
  if (data.sdp) {
    await peerConn.setRemoteDescription(new RTCSessionDescription(data.sdp));
    if (data.sdp.type === 'offer') {
      const answer = await peerConn.createAnswer();
      await peerConn.setLocalDescription(answer);
      socket.emit('signal', { room: roomInput.value, data: { sdp: peerConn.localDescription } });
    }
  }
  if (data.candidate) {
    await peerConn.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

function initPeer(initiator) {
  console.log("Initializing peer, initiator:", initiator);
  
  peerConn = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  });

  peerConn.onicecandidate = e => {
    if (e.candidate) {
      console.log("Sending ICE candidate");
      socket.emit('signal', { room: roomInput.value, data: { candidate: e.candidate } });
    }
  };

  peerConn.onconnectionstatechange = () => {
    console.log("Peer connection state:", peerConn.connectionState);
  };

  if (initiator) {
    dataChannel = peerConn.createDataChannel('chat');
    setupChannel();
    peerConn.createOffer().then(offer => {
      peerConn.setLocalDescription(offer);
      socket.emit('signal', { room: roomInput.value, data: { sdp: offer } });
    });
  } else {
    peerConn.ondatachannel = e => {
      console.log("📥 Received data channel");
      dataChannel = e.channel;
      setupChannel();
    };
  }
}


function setupChannel() {
  console.log("Data channel setup");
  dataChannel.onopen = () => {
    console.log("✅ Data channel open");
  };
  dataChannel.onmessage = e => {
  const data = JSON.parse(e.data);
  if (data.type === 'text') {
    appendMessage(data.name, data.content, false);
  
  } else if (data.type === 'file') {
      const blob = new Blob([new Uint8Array(data.content)], { type: data.mime });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = data.name;
      a.textContent = 'Download ' + data.name;
      chatLog.value += `\nFile received: ${data.name}\n`;
      status.appendChild(a);
    }
  };
}


sendMsg.onclick = () => {
  const msg = msgInput.value.trim();
  if (!msg) return;

  const messageData = { type: 'text', content: msg, name: myName };
  dataChannel.send(JSON.stringify(messageData));
  appendMessage(myName, msg, true);
  msgInput.value = '';
};



fileInput.onchange = () => {
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    dataChannel.send(JSON.stringify({
      type: 'file',
      content: Array.from(new Uint8Array(reader.result)),
      name: file.name,
      mime: file.type
    }));
    chatLog.value += `You sent file: ${file.name}\n`;
  };
  reader.readAsArrayBuffer(file);
};
function appendMessage(name, message, isMine) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message');
  msgDiv.classList.add(isMine ? 'you' : 'peer');

  // Add the sender name above the message bubble
  const nameDiv = document.createElement('div');
  nameDiv.classList.add('sender-name');
  nameDiv.textContent = name;
  msgDiv.appendChild(nameDiv);

  // Add the message text
  const textDiv = document.createElement('div');
  textDiv.classList.add('message-text');
  textDiv.textContent = message;
  msgDiv.appendChild(textDiv);

  chatLog.appendChild(msgDiv);
  chatLog.scrollTop = chatLog.scrollHeight; // scroll to bottom
}
