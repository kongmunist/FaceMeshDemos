async function setupCamera() {
  video = document.getElementById('video');
  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      facingMode: 'user',
      width: {ideal:1920},
      height: {ideal:1080},
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

// Calls face mesh on the video and outputs the eyes and face bounding boxes to global vars
var curFaces = [];
async function renderPrediction() {
    const facepred = await fmesh.estimateFaces(video);

    if (facepred.length > 0) { // If we find a face, process it
      curFaces = facepred;
    }

  requestAnimationFrame(renderPrediction);
};

function drawVideo(){
  ctx.drawImage(video, 0, 0);
  for (face of curFaces){
    if (face.faceInViewConfidence > .95) {
      drawFace(face);  
    }
  } 
  requestAnimationFrame(drawVideo);
}

// Draws the current eyes onto the canvas, directly from video streams
async function drawFace(face){
   let i = 0;
   ctx.fillStyle = 'cyan';
   ctx.font = "10px Arial";
    for (pt of face.scaledMesh){
      ctx.beginPath();
      ctx.ellipse(pt[0], pt[1], 3,3, 0, 0, 2*Math.PI)
      ctx.fill();

      ctx.strokeText(i, pt[0], pt[1]);
      i = i+1;
    }
}


var canvas;
var ctx;
async function main() {
    fmesh = await facemesh.load({maxFaces:3});

    // Set up front-facing camera
    await setupCamera();
    videoWidth = video.videoWidth;
    videoHeight = video.videoHeight;
    video.play()

    // HTML Canvas for the video feed
    canvas = document.getElementById('facecanvas');
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    ctx = canvas.getContext('2d');

    drawVideo()
    renderPrediction();
}


