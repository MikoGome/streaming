const fs = require('fs');
const path = require('path');
const {convert} = require('./srt2vtt.js');
const express = require('express');
const app = express();
const https = require('https');

const folder = '../' + process.env.VIDEO + '/';
const files = fs.readdirSync(folder);


const video = folder + files.find(file => file.endsWith('.mp4'));
const subtitle = convert(folder + files.find(file => file.endsWith('.srt')));

const size = fs.statSync(video).size;

app.use(express.static('.'));

app.use(function(req, res, next) {
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains'); // 2 years
  }
  next(); 
})

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

// const server = app.listen(3000, () => console.log('http server started at 3000'));

const socket = require('socket.io');

// const io = socket(server);

const socketHandler = (socket) => {
   
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
}

// io.on('connection', socketHandler);

const cert = fs.readFileSync('ca-bundle.txt');
const key = fs.readFileSync('private-key.txt');

const server2 = https.createServer({cert, key}, app).listen(3001, () => console.log('https server started at 3001'));

const io2 = socket(server2);

io2.on('connection', socketHandler);