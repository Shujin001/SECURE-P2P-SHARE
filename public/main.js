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
  let incomingFileInfo = null;
let incomingFileData = [];
let incomingFileReceivedSize = 0;

dataChannel.onmessage = e => {
  if (typeof e.data === 'string') {
    // Could be JSON message or text
    let data;
    try {
      data = JSON.parse(e.data);
    } catch {
      // Not JSON, treat as plain text message
      chatLog.innerHTML += `<div class="peer">${e.data}</div>`;
      chatLog.scrollTop = chatLog.scrollHeight;
      return;
    }

    if (data.type === 'text') {
      chatLog.innerHTML += `<div class="peer">${data.content}</div>`;
      chatLog.scrollTop = chatLog.scrollHeight;
    } else if (data.type === 'file-meta') {
      // Prepare to receive file
      incomingFileInfo = data;
      incomingFileData = [];
      incomingFileReceivedSize = 0;
      console.log('Incoming file:', incomingFileInfo.name);
    }
  } else {
    // Binary chunk received
    incomingFileData.push(e.data);
    incomingFileReceivedSize += e.data.byteLength;

    if (incomingFileReceivedSize === incomingFileInfo.size) {
      // All chunks received - reconstruct file
      const receivedBlob = new Blob(incomingFileData, { type: incomingFileInfo.mime });
      const url = URL.createObjectURL(receivedBlob);

      const a = document.createElement('a');
      a.href = url;
      a.download = incomingFileInfo.name;
      a.textContent = `Download ${incomingFileInfo.name}`;
      status.appendChild(a);

      chatLog.innerHTML += `<div class="peer">File received: ${incomingFileInfo.name}</div>`;
      chatLog.scrollTop = chatLog.scrollHeight;

      // Reset
      incomingFileInfo = null;
      incomingFileData = [];
      incomingFileReceivedSize = 0;
    }
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
  if (!dataChannel || dataChannel.readyState !== 'open') {
    alert('Data channel not ready. Cannot send file.');
    return;
  }

  const chunkSize = 16 * 1024; // 16KB chunks
  let offset = 0;

  // Send file metadata first
  dataChannel.send(JSON.stringify({
    type: 'file-meta',
    name: file.name,
    size: file.size,
    mime: file.type,
    senderName: "you"
  }));

  const reader = new FileReader();

  reader.onload = e => {
    dataChannel.send(e.target.result); // send ArrayBuffer chunk
    offset += chunkSize;
    if (offset < file.size) {
      readSlice(offset);
    } else {
      console.log('File sent completely.');
      chatLog.innerHTML += `<div class="you">You sent file: ${file.name}</div>`;
      chatLog.scrollTop = chatLog.scrollHeight;
    }
  };

  function readSlice(o) {
    const slice = file.slice(o, o + chunkSize);
    reader.readAsArrayBuffer(slice);
  }

  // Start reading first slice
  readSlice(0);
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
