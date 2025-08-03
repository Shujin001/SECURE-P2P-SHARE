const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://secrettalkz.netlify.app", // ✅ your Netlify frontend
    methods: ["GET", "POST"]
  }
});
const cors = require('cors');
app.use(cors({
  origin: "https://secrettalkz.netlify.app"
}));

app.use(express.static('public'));

io.on('connection', socket => {
  socket.on('join', (room) => {
  socket.join(room);
  socket.to(room).emit('peer-joined'); // 🔥 Critical
});

socket.on('signal', ({ room, data }) => {
  socket.to(room).emit('signal', data); // 🔁 Relay SDP and ICE
});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));