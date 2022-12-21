const fs = require('fs');
const path = require('path');
const {convert} = require('./srt2vtt.js');
const express = require('express');
const app = express();

const files = fs.readdirSync('../');

const video = '../' + files.find(file => file.endsWith('.mp4'));
const subtitle = convert('../' + files.find(file => file.endsWith('.srt')));

const size = fs.statSync(video).size;

app.use(express.static('.'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/video', (req, res) => {
  if(!req.headers.range) return res.end('"please provide a range"');
  const start = Number(req.headers.range.replace(/\D/g, ''));
  const chunk = 512000; //512kb
  const end = Math.min(start + chunk, size - 1);
  const length = end - start + 1;
  res.writeHead(206, {
    'Content-Type': 'video/mp4',
    'Content-Length': length,
    'Accept-Ranges': 'bytes',
    'Content-Range': `bytes ${start}-${end}/${size}`,
  });
  fs.createReadStream(video, {start, end}).pipe(res);
});

app.get('/subtitle', (req, res) => {
  res.end(subtitle);
});

app.use((req, res) => {
  res.redirect('/');
});

const server = app.listen(3000, () => console.log('server started'));

const socket = require('socket.io');

const io = socket(server);

io.on('connection', (socket) => {
   
  socket.on('follow', (id) => {
    socket.broadcast.emit('lead', id);
  });

  socket.on('guide', (id, currentTime, isPaused) => {
    socket.to(id).emit('follow', currentTime, isPaused);
  });

  socket.on('play', (currentTime) => {
    socket.broadcast.emit('play', currentTime);
  });

  socket.on('pause', () => {
    socket.broadcast.emit('pause');
  });

  socket.on('updateTime', (currentTime) => {
    socket.broadcast.emit('updateTime', currentTime);
  });
});