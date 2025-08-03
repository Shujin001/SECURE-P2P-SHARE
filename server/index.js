const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors({
  origin: "https://secrettalkz.netlify.app"
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://secrettalkz.netlify.app",
    methods: ["GET", "POST"]
  }
});

app.use(express.static('public'));

io.on('connection', socket => {
  socket.on('join', (room) => {
    socket.join(room);
    socket.to(room).emit('peer-joined');
  });

  socket.on('signal', ({ room, data }) => {
    socket.to(room).emit('signal', data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
