let socket = null;

const currentColor = "white";

document.querySelectorAll('path').forEach(el => {
  el.setAttribute('fill', currentColor);
});

document.querySelector('#time').style.color = currentColor;

const video = document.querySelector('video');
const subtitleColorButton = document.getElementById('subtitle-color');
const syncButton = document.getElementById('sync');

fetch('/video')
.then(res => res.json())
.then(data => {
  const {id} = data;
  const source = document.querySelector('source');
  source.setAttribute('src', id);
  video.load();
  video.dispatchEvent(new Event('appear'));
  document.querySelector('h1').innerText = decodeURIComponent(id).replace(/^\[.*?\]|\.\w+$/g, '').trim();
  document.querySelector('h1').classList.add('appear');

  //initalize volume range
  if(localStorage.getItem("volume")) {
    volumeRange.value = localStorage.getItem("volume");
    video.volume = volumeRange.value/100;
  }
  
  if(sessionStorage.getItem("sync")) {
    syncButton.click();
  }
  if(sessionStorage.getItem("subtitle")) {
    subtitleButton.click();
  }
});

function togglePlay() {
  if(video.paused) {
    pause.willPause = false;
    video.play();
    playButton.innerHTML = `
      <svg class="pause-icon" viewBox="0 0 24 24">
        <path fill="${currentColor}" d="M14,19H18V5H14M6,19H10V5H6V19Z" />
      </svg>
    `
    if(socket) socket.emit('play', video.currentTime);
  } else {
    video.pause();
    playButton.innerHTML = `
      <svg class="play-icon" viewBox="0 0 24 24">
        <path fill="${currentColor}" d="M8,5.14V19.14L19,12.14L8,5.14Z" />
      </svg>
    `
    if(socket) socket.emit('pause', video.currentTime);
  }
}

function secondsToString(secs) {
  const date = new Date(secs * 1000);
  const hours = String(date.getUTCHours());
  const minutes = String(date.getUTCMinutes());
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return hours !== '0' ? hours + ':' + minutes.padStart(2, '0') + ':' + seconds : minutes + ':' + seconds;
}

function timeString() {
  return secondsToString(video.currentTime) + '/' + secondsToString(video.duration);
}

syncButton.addEventListener('click', () => {
  if(socket === null) {
    socket = io(location.host);
    sessionStorage.setItem("sync", true);
    socket.on('connect', () => {
      const customEvent = new CustomEvent('connect', {detail: socket});
      document.body.dispatchEvent(customEvent);
    });
  } else {
    socket.disconnect();
    sessionStorage.removeItem("sync");
    socket = null;
  }
  syncButton.classList.toggle('green', socket);
});


subtitleColorButton.addEventListener('click', () => {
  const color = getComputedStyle(document.documentElement).getPropertyValue('--text-color');  
  if(color === 'white') {
    document.documentElement.style.setProperty('--text-color', 'yellow');
    subtitleColorButton.classList.add('yellow');
  } else {
    document.documentElement.style.setProperty('--text-color', 'white');
    subtitleColorButton.classList.remove('yellow');
  }
});


const pause = {
  time: 0,
  willPause: false
} 

document.body.addEventListener('connect', (e) => {
  const socket = e.detail;
  const id = socket.id;
  
  socket.emit("check", document.querySelector("source").src.replace(location.href, ""));
  socket.emit('follow', id);
  socket.emit("getStrokeData");

  socket.on('lead', (id) => {
    const currentTime = video.currentTime;
    const isPaused = video.paused;
    socket.emit('guide', id, currentTime, isPaused)
  });

  socket.once('follow', (currentTime, isPaused) => {
    video.currentTime = currentTime;
    if(isPaused) {
      video.pause();
      playButton.innerHTML = `
      <svg class="play-icon" viewBox="0 0 24 24">
        <path fill="${currentColor}" d="M8,5.14V19.14L19,12.14L8,5.14Z" />
      </svg>
      `
    } else {
      video.play();
      playButton.innerHTML = `
      <svg class="pause-icon" viewBox="0 0 24 24">
        <path fill="${currentColor}" d="M14,19H18V5H14M6,19H10V5H6V19Z" />
      </svg>
      `
    }
  });

  socket.on('play', (currentTime) => {
    pause.willPause = false;
    video.play();
    playButton.innerHTML = `
    <svg class="pause-icon" viewBox="0 0 24 24">
      <path fill="${currentColor}" d="M14,19H18V5H14M6,19H10V5H6V19Z" />
    </svg>
  `
  });
  
  socket.on('pause', (pauseTime) => {
    if(video.paused) return;
    pause.time = pauseTime;
    pause.willPause = true;
    playButton.innerHTML = `
    <svg class="play-icon" viewBox="0 0 24 24">
      <path fill="${currentColor}" d="M8,5.14V19.14L19,12.14L8,5.14Z" />
    </svg>
  `
  });

  socket.on('updateTime', (currentTime) => {
    video.currentTime = currentTime;
  });

  socket.on("reload", ()=>{
    window.location.reload(true)
  });

  socket.on('receiveStrokeData', (strokeData) => {
    drawStrokeData(strokeData);
  });
  
  socket.on('erase', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('getStrokeData');
  });

  socket.on("toggleCanvas", (isOpen)=>{
    openCanvas(false, isOpen);
  });

  socket.on("startVote", ()=> {
    startVote();
  });

  socket.on("displayScore", (scores) => {
    displayScore(scores.map(({score}) => score));
  });

});

function displayScore(scores) {
  const score=parseFloat(scores.reduce((a,b) => a + b)/scores.length).toFixed(2);
  const div = document.createElement("div");
  const form = document.createElement("form");
  const container = document.createElement("div");
  container.setAttribute("id", "score")

  const h1=document.createElement("h1");
  h1.innerText=score
  let description = "";
  if(score === 10) description = "masterpiece";
  if(score < 10) description = "exceptional";
  if(score < 9.5) description = "fantastic";
  if(score < 9) description = "great";
  if(score < 8) description = "good";
  if(score < 7) description = "mediocre";
  if(score < 6) description = "poor";
  if(score < 5) description = "bad";
  if(score < 4) description = "horrible";
  if(score < 3) description = "appalling";
  if(score < 2) description = "shit";

  const scoreDescription = document.createElement("span");
  scoreDescription.innerText=description;


  const scoresList = document.createElement("ul");
  scores.forEach((score) => {
    const li = document.createElement("li");
    li.innerText = score;
    scoresList.append(li);
  });
  

  function animateScores(scores, i=0) {
    if(i >= scores.length) {
      h1.classList.add("textappear");
      h1.addEventListener("animationend", ()=>{
        scoreDescription.classList.add("textappear");
      }, {once: true});
      return;
    };
    
    const score = scores[i];
    score.classList.add("textappear");
    score.addEventListener("animationend", ()=>{
      animateScores(scores, i + 1);
    }, {once:true});
  }
  
  
  
  div.setAttribute("id", "voteboard")
  div.append(container);
  container.append(h1);
  container.append(scoreDescription);
  container.append(scoresList);
  
  div.addEventListener("animationend", () => {
    animateScores(scoresList.children, 0);
  }, {once: true});
  
  div.classList.add("animate-darken");
  container.classList.add("animate-slidedown");
  

  div.addEventListener("click", (e)=>{
    e.preventDefault();
    div.classList.remove("animate-darken");
    container.classList.remove("animate-slidedown");
    void div.offsetWidth;
    div.classList.add('animate-reverse', "animate-darken");
    container.classList.add("animate-reverse", "animate-slidedown");
    div.addEventListener("animationend", () => div.remove());
  });

  main.append(div)
}

function startVote() {
  const div = document.createElement("div");
  const form = document.createElement("form");
  const input = document.createElement("input");
  const submit = document.createElement("button");

  const h1=document.createElement("h1");
  h1.innerText="What is your score?"

  submit.innerText = "SUBMIT";
  

  div.setAttribute("id", "voteboard")
  div.append(form);
  form.append(h1);
  form.append(input);
  form.append(submit);

  div.classList.add("animate-darken");
  form.classList.add("animate-slidedown");


  input.setAttribute("type", "number");
  input.setAttribute("min", 1);
  input.setAttribute("max", 10);
  input.setAttribute("step", 0.5);
  input.setAttribute("name", "vote");

  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    if(socket) socket.emit("castVote", e.target.vote.value);
    div.classList.remove("animate-darken");
    form.classList.remove("animate-slidedown");
    void div.offsetWidth;
    div.classList.add('animate-reverse', "animate-darken");
    form.classList.add("animate-reverse", "animate-slidedown");
    div.addEventListener("animationend", () => div.remove());
  });

  main.append(div)
}

video.addEventListener('play', () => {
  pause.time = 0;
  pause.willPause = false;
});

document.body.addEventListener('keydown', (e) => {
  if((e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    // isChangingTime = true;
    if(e.key === "ArrowLeft") video.currentTime = Math.max(video.currentTime - 5, 0);
    else if(e.key === "ArrowRight") video.currentTime = Math.min(video.currentTime + 5, video.duration);

    if(socket) socket.emit('updateTime', video.currentTime);
  } else if(e.key === ' ') {
    togglePlay();
  } else if(e.key.toLowerCase() === 'f') {
    toggleFullscreen();
  } else if(e.key === 'ArrowUp') {
    volumeRange.value = Math.min(Number(volumeRange.value) + 10, 100);
    volumeRange.dispatchEvent(new Event('input'));
  } else if(e.key === 'ArrowDown') {
    volumeRange.value = Math.max(Number(volumeRange.value) - 10, 0);
    volumeRange.dispatchEvent(new Event('input'));
  } else if (e.key === 'c') {
    subtitleButton.click();
  }
});

// document.body.addEventListener('keyup', (e) => {
//   if((e.key === 'ArrowLeft' || e.key === 'ArrowRight')) isChangingTime = false;
// });

video.addEventListener('click', (e) => {
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) return;
  togglePlay();
});

const time = document.getElementById('time');

video.addEventListener('timeupdate', () => {
  if (!input.getAttribute('max')) {
    input.setAttribute('max', video.duration);
  }
  time.innerText = timeString();
  if(isChangingTime) return;
  input.value = video.currentTime;
  if(pause.willPause && video.currentTime >= pause.time) {
    video.pause();
    video.currentTime = pause.time;
    pause.willPause = false;
  }
});

//controls

const player = document.getElementById('player')
const input = document.querySelector('input');
const playButton = document.getElementById('play');
const fullscreenButton = document.getElementById('fullscreen');
const subtitleButton = document.getElementById('subtitle');
const main = document.querySelector('main');
const track = document.querySelector('track');
const subtitleHolder = document.querySelector('.subtitle-holder');
const subtitleHolders = document.querySelectorAll('.subtitle-holder');

main.addEventListener('mousedown', (e) => {
  if(e.button === 1) {
    openCanvas(socket);
    return;
  }
});

track.addEventListener('load', () => {
  if(!track.track.cues.length) return;
  function subAppear() {
    const subtitles = document.querySelectorAll('.subtitles');
    subtitles.forEach(subtitle => {
      while(subtitle.firstChild) {
        subtitle.firstChild.remove();
      }
      subtitle.classList.add('hidden');
    });
    for(const cue of track.track.activeCues) {
      let sub = document.querySelector('#sub-2');
      let text = cue.text;
      if(/{\\an.}/.test(text)) {
        const num = Number(text.match(/{\\an.}/g).join('').replace(/\D/g, ''));
        sub = document.querySelector('#sub-'+num);
        text = text.replace(/{\\an.}/, '');
      }
      const subContent = document.createElement('p');
      subContent.innerHTML += text;
      sub.append(subContent);
      sub.classList.remove('hidden');
    }
  }
  
  subAppear();
  track.track.oncuechange = subAppear;
});

function toggleFullscreen() {
  if(document.fullscreenElement === null) {
    main.requestFullscreen();
  } else if(document.fullscreenElement === main) {
    document.exitFullscreen();
  }
  fullscreenButton.classList.toggle('active', !document.fullscreenElement);
}

document.addEventListener('fullscreenchange', () => {
  if(document.fullscreenElement) {
    subtitleHolders.forEach(subtitleHolder => {
      subtitleHolder.classList.add('fullscreen');
    });
    fullscreenButton.innerHTML = `
      <svg class="close" viewBox="0 0 24 24">
        <path fill="${currentColor}" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
      </svg>
    `
  } else {
    subtitleHolders.forEach(subtitleHolder => {
      subtitleHolder.classList.remove('fullscreen');
    });
    fullscreenButton.innerHTML = `
      <svg class="open" viewBox="0 0 24 24">
        <path fill="${currentColor}" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
      </svg>
    `
  }
});

video.addEventListener('loadedmetadata', () => {
  input.setAttribute('max', video.duration);
  time.innerText = timeString();
});

video.addEventListener('loadedmetadata', (e) => {
  e.target.volume = volumeRange.value/100;
});

let ctx;
let drawStrokeData;
let canvas;

video.addEventListener('loadedmetadata', () => {
  const {ctx: tempCtx, drawStrokeData: tempDrawStrokeData, canvas: tempCanvas} = createCanvas(video.videoWidth, video.videoHeight);
  ctx = tempCtx,
  drawStrokeData = tempDrawStrokeData;
  canvas = tempCanvas;
})

playButton.addEventListener('click', (e) => {
  togglePlay();
});

playButton.addEventListener('keydown', (e) => {
  e.preventDefault();
});

fullscreenButton.addEventListener('click', () => {
  toggleFullscreen();
});

let isChangingTime = false;

input.addEventListener('mousedown', () => {
  isChangingTime = true;
});

input.addEventListener('mouseup', () => {
  isChangingTime = false;
});

input.addEventListener('touchstart', () => {
  isChangingTime = true;
});

input.addEventListener('touchend', () => {
  isChangingTime = false;
});

input.addEventListener('click', (e) => {
  video.currentTime = e.target.value;
  if(socket) socket.emit('updateTime', video.currentTime);
});

input.addEventListener('touchend', (e) => {
  video.currentTime = e.target.value;
  if(socket) socket.emit('updateTime', video.currentTime);
});

subtitleButton.addEventListener('click', () => {
  const mode = video.textTracks[0].mode;
  const output = mode === 'showing' ? 'disabled' : 'showing';
  video.textTracks[0].mode = output;
  document.querySelectorAll('.subtitles').forEach(sub => {
    sub.classList.toggle('hidden', !(output === 'showing'));
  });
  subtitleButton.classList.toggle('active', output === 'showing');
  if(output === "showing") sessionStorage.setItem("subtitle", true);
  else sessionStorage.removeItem("subtitle");
});

let timeoutID = null;
let mouseOnPlayer = false;
const timeoutDuration = 3000;

main.addEventListener('mousemove', () => {
  clearTimeout(timeoutID);
  player.dispatchEvent(new CustomEvent('hide', {detail: false}));
  if(video.paused || mouseOnPlayer) return;
  timeoutID = setTimeout(() => {
    player.dispatchEvent(new CustomEvent('hide', {detail: true}));
  }, timeoutDuration)
});

main.addEventListener('dblclick', () => {
  toggleFullscreen();
});

player.addEventListener('mouseenter', () => {
  if(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) return;
  mouseOnPlayer = true;
});

player.addEventListener('mouseleave', () => {
  mouseOnPlayer = false;
});

main.addEventListener('mouseleave', () => {
  mouseOnPlayer = false;
  timeoutID = setTimeout(() => {
    player.dispatchEvent(new CustomEvent('hide', {detail: true}));
  }, 500);
});

const volumeRange = document.getElementById('volume-range');

volumeRange.addEventListener('input', () => {
  localStorage.setItem("volume", volumeRange.value);
  video.volume = volumeRange.value/100;
});

video.addEventListener('pause', () => {
  player.dispatchEvent(new CustomEvent('hide', {detail: false}));
});

video.addEventListener('play', () => {
  timeoutID = setTimeout(() => {
    player.dispatchEvent(new CustomEvent('hide', {detail: true}));
  }, timeoutDuration)
});

video.addEventListener('ended', () => {
  playButton.innerHTML = `
      <svg class="play-icon" viewBox="0 0 24 24">
        <path fill="${currentColor}" d="M8,5.14V19.14L19,12.14L8,5.14Z" />
      </svg>
    `
});

const speaker = document.getElementById('speaker');

speaker.addEventListener('click', () => {
  if(video.muted) {
    video.muted = false;
    speaker.innerHTML = `
      <svg class="volume-high-icon" viewBox="0 0 24 24">
        <path fill="${currentColor}" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z" />
      </svg>
    `
  } else {
    video.muted = true;
    speaker.innerHTML = `
      <svg class="volume-muted-icon" viewBox="0 0 24 24">
        <path fill="${currentColor}" d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z" />
      </svg>
    `
  }
});

document.querySelectorAll('button, input[type=range]').forEach(button => {
  button.addEventListener('focus', (e) => {
    e.target.blur();
  });
});

let cursorClearTimeoutID = null;

main.addEventListener('mousemove', (e) => {
  clearTimeout(cursorClearTimeoutID);
  main.classList.remove('cursor-none');
  cursorClearTimeoutID = setTimeout(() => {
    main.classList.add('cursor-none');
  }, 5000);
}, {capture: true});

player.addEventListener('mousemove', (e) => {
  clearTimeout(cursorClearTimeoutID);
});

player.addEventListener('hide', (e) => {
  document.documentElement.style.setProperty('--player-height', `${player.clientHeight}px`);
  const flag = e.detail;
  player.classList.toggle('hide', flag);
  subtitleHolder.classList.toggle('raise', !flag);
});

player.addEventListener('dblclick', (e) => {
  e.stopPropagation();
});

video.addEventListener('appear', () => {
  syncButton.classList.remove('hidden');
  main.classList.remove('hidden');
  subtitleColorButton.classList.remove('hidden');
});

function animationEnd(el) {
  el.addEventListener('animationend', () => {
    el.classList.remove('appear');
  })
}

animationEnd(syncButton);
animationEnd(main);
animationEnd(subtitleColorButton);

//canvas

function createCanvas(originalWidth, originalHeight) {
  const canvas = document.createElement('canvas');

  main.appendChild(canvas);
  const ctx = canvas.getContext('2d', {
    willReadFrequently: true
  });
  
  const initializeCanvas = (width, height) => {
    ctx.canvas.width = width;
    ctx.canvas.height = height;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 3;
    ctx.shadowColor = "black";
    ctx.strokeStyle = "red";
  }
  
  initializeCanvas(originalWidth, originalHeight);
  
  
  let isDrawing = false;
  
  const strokeData = [];
  
  let myPath;

  let scaleWidth = 1;
  let scaleHeight = 1;
  
  canvas.addEventListener('mousedown', (e)=> {
    if(e.button !== 0) return;
    isDrawing = true;
    myPath = new Path2D();
    const x = e.offsetX;
    const y = e.offsetY;
    myPath.moveTo(x, y);
    myPath.lineTo(x, y);
    ctx.stroke(myPath);
    strokeData.push([x / scaleWidth, y / scaleHeight]);
  });
  
  canvas.addEventListener('mouseup', () => {
    isDrawing = false;
    if(socket) socket.emit('sendStrokeData', strokeData);
    strokeData.length = 0;
  });
  
  canvas.addEventListener('mouseleave', () => {
    isDrawing = false;
    if(socket) socket.emit('sendStrokeData', strokeData);
    strokeData.length = 0;
  })
  
  canvas.addEventListener('mousemove', (e) => {
    if(!isDrawing) return;
    const x = e.offsetX;
    const y = e.offsetY;
    myPath.lineTo(x, y);
    ctx.stroke(myPath);
    strokeData.push([x / scaleWidth, y / scaleHeight]);
  });
  
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if(socket) socket.emit('erase');
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
  
  let otherPath;
  
  const drawStrokeData = (strokeData) => {
    strokeData.forEach(([x,y], index) => {
      if(index === 0) {
        otherPath = new Path2D();
        otherPath.moveTo(x * scaleWidth, y * scaleHeight);
        otherPath.lineTo(x * scaleWidth, y * scaleHeight);
        ctx.stroke(otherPath);
        return;
      }
      otherPath.lineTo(x * scaleWidth, y * scaleHeight);
      ctx.stroke(otherPath);
    });
  }

  let setTimeoutID = null;
  
  const resizeCanvas = (width, height) => {
    initializeCanvas(width, height);
    scaleWidth = width/originalWidth;
    scaleHeight = height/originalHeight;
    clearTimeout(setTimeoutID);
    setTimeout(() => {
      if(socket) socket.emit('getStrokeData');
    }, 500)
  }

  const resizeObserver = new ResizeObserver((entries) => {
    if(entries[0].target === video) {
      resizeCanvas(video.clientWidth, video.clientWidth * (video.videoHeight/video.videoWidth));
    }
  })
  
  resizeObserver.observe(video)

  return {
    canvas,
    ctx,
    drawStrokeData
  }
}

const paintButton = document.querySelector("#paint");

paintButton.addEventListener('click', () => {
  openCanvas(socket);
});

function openCanvas(willEmit, isOpen) {
  if(!isOpen) canvas.dispatchEvent(new Event("mouseup"));
  canvas.classList.toggle('active', isOpen);
  paintButton.classList.toggle('active', canvas.classList.contains('active'));
  if(willEmit) socket.emit("toggleCanvas", canvas.classList.contains('active'));
}