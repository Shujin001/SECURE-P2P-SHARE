const socket = io("https://secure-p2p-share.onrender.com/");
let peerConn;
let dataChannel;

const joinBtn = document.getElementById('joinBtn');
const roomInput = document.getElementById('roomInput');
const chatSection = document.getElementById('chatSection');
const chatLog = document.getElementById('chatLog');
const msgInput = document.getElementById('msgInput');
const sendMsg = document.getElementById('sendMsg');
const fileInput = document.getElementById('fileInput');
const status = document.getElementById('status');

joinBtn.onclick = async () => {
  const room = roomInput.value;
  socket.emit('join', room);
  initPeer(true);
  chatSection.style.display = 'block';
};

socket.on('peer-joined', () => initPeer(false));

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
  peerConn = new RTCPeerConnection();

  if (initiator) {
    dataChannel = peerConn.createDataChannel('chat');
    setupChannel();
  } else {
    peerConn.ondatachannel = e => {
      dataChannel = e.channel;
      setupChannel();
    };
  }

  peerConn.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('signal', { room: roomInput.value, data: { candidate: e.candidate } });
    }
  };

  if (initiator) {
    peerConn.createOffer().then(offer => {
      peerConn.setLocalDescription(offer);
      socket.emit('signal', { room: roomInput.value, data: { sdp: offer } });
    });
  }
}

function setupChannel() {
  dataChannel.onmessage = e => {
    const data = JSON.parse(e.data);
    if (data.type === 'text') {
      chatLog.value += 'Peer: ' + data.content + '\n';
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
  const msg = msgInput.value;
  dataChannel.send(JSON.stringify({ type: 'text', content: msg }));
  chatLog.value += 'You: ' + msg + '\n';
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