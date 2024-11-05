const fs = require('fs');
const path = require('path');
const {convert} = require('./srt2vtt.js');
const express = require('express');
const app = express();
const https = require('https');

const folder =  '../' + process.env.VIDEO + '/';
const files = fs.readdirSync(folder);


const video = files.find(file => file.endsWith('.mp4') || file.endsWith('.webm'));
const filePath = folder + '/' + video;

console.log('VIDEO: ' + video);

const srt = files.find(file => file.endsWith('.srt'));
const subtitle = convert(srt ? folder + files.find(file => file.endsWith('.srt')) : null);

const ID = encodeURIComponent(video);

const PORT = process.env.PORT || 3000;

app.use(express.static('.'));

app.get('/', (req, res) => {
  return res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/video', (req, res) => {
  return res.json({id: ID});
})

// app.get('/'+ID, (req, res) => {
//   if(!req.headers.range) {
//     return res.end('"please provide a range"');
//   }
//   const start = Number(req.headers.range.replace(/\D/g, ''));
//   const chunk = 512000 * 4; //512kb
//   const end = Math.min(start + chunk, size - 1);
//   const length = end - start + 1;
//   res.writeHead(206, {
//     'Content-Type': 'video/mp4',
//     'Content-Length': length,
//     'Accept-Ranges': 'bytes',
//     'Content-Range': `bytes ${start}-${end}/${size}`,
//   });
//   return fs.createReadStream(video, {start, end}).pipe(res);
//   // res.sendFile(path.resolve(video));
// });

app.get('/'+ID, (req, res) => {
  const options = {};

  let start;
  let end;

  const range = req.headers.range;
  if (range) {
      const bytesPrefix = "bytes=";
      if (range.startsWith(bytesPrefix)) {
          const bytesRange = range.substring(bytesPrefix.length);
          const parts = bytesRange.split("-");
          if (parts.length === 2) {
              const rangeStart = parts[0] && parts[0].trim();
              if (rangeStart && rangeStart.length > 0) {
                  options.start = start = parseInt(rangeStart);
              }
              const rangeEnd = parts[1] && parts[1].trim();
              if (rangeEnd && rangeEnd.length > 0) {
                  options.end = end = parseInt(rangeEnd);
              }
          }
      }
  }

  res.setHeader("content-type", "video/mp4");

  fs.stat(filePath, (err, stat) => {
      if (err) {
          console.error(`File stat error for ${filePath}.`);
          console.error(err);
          res.sendStatus(500);
          return;
      }

      let contentLength = stat.size;

      if (req.method === "HEAD") {
          res.statusCode = 200;
          res.setHeader("accept-ranges", "bytes");
          res.setHeader("content-length", contentLength);
          res.end();
      }
      else {       
          let retrievedLength;
          if (start !== undefined && end !== undefined) {
              retrievedLength = (end+1) - start;
          }
          else if (start !== undefined) {
              retrievedLength = contentLength - start;
          }
          else if (end !== undefined) {
              retrievedLength = (end+1);
          }
          else {
              retrievedLength = contentLength;
          }

          res.statusCode = start !== undefined || end !== undefined ? 206 : 200;

          res.setHeader("content-length", retrievedLength);

          if (range !== undefined) {  
              res.setHeader("content-range", `bytes ${start || 0}-${end || (contentLength-1)}/${contentLength}`);
              res.setHeader("accept-ranges", "bytes");
          }

          const fileStream = fs.createReadStream(filePath, options);
          fileStream.on("error", error => {
              console.log(`Error reading file ${filePath}.`);
              console.log(error);
              res.sendStatus(500);
          });


          fileStream.pipe(res);
      }
  });
})

app.get('/subtitle', (req, res) => {
  return res.end(subtitle);
});

const server = app.listen(PORT, () => console.log('http server started at ' + PORT));

const socket = require('socket.io');

const io = socket(server);

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

  socket.on('pause', (currentTime) => {
    socket.broadcast.emit('pause', currentTime);
  });

  socket.on('updateTime', (currentTime) => {
    socket.broadcast.emit('updateTime', currentTime);
  });
}

io.on('connection', socketHandler);

//const cert = fs.readFileSync('ca-bundle.txt');
//const key = fs.readFileSync('private-key.txt');

//const server2 = https.createServer({cert, key}, app).listen(Number(PORT) + 1, () => console.log('https server started at ' + (Number(PORT) + 1)));

//const io2 = socket(server2);

//io2.on('connection', socketHandler);
