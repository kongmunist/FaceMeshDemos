
async function setupCamera() {
  video = document.getElementById('video');
  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      facingMode: 'user',
      aspectRatio: 1.333,
      width: {ideal: 1280},
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}


var curFaces;
// Calls face mesh on the video and outputs the eyes and face bounding boxes to global vars
async function renderPrediction() {
    const facepred = await fmesh.estimateFaces(canvas);
    ctx.drawImage(video, 0, 0, canvas.width,  canvas.height);


    if (facepred.length > 0) { // If we find a face, process it  
      curFaces = facepred;
      await drawFaces();
    }
    
    requestAnimationFrame(renderPrediction);
};



//        At around 10 Hz for the camera, we want like 5 seconds of history
var maxHistLen = 64;
var bloodHist = Array(maxHistLen).fill(0);
var timingHist = Array(maxHistLen).fill(0);
var last = performance.now();
var average = (array) => array.reduce((a, b) => a + b) / array.length;
var argMax = (array) => array.map((x, i) => [x, i]).reduce((r, a) => (a[0] > r[0] ? a : r))[1];
// Draws the current eyes onto the canvas, directly from video streams
async function drawFaces(){
  ctx.strokeStyle = "cyan";
  ctx.lineWidth = 2;
  for (face of curFaces){
    if (face.faceInViewConfidence > .90) {
      let mesh = face.scaledMesh;

      // Get the facial region of interest's bounds 
      boxLeft = mesh[117][0];
      boxTop = mesh[117][1];
      boxWidth = mesh[346][0] - boxLeft;
      boxHeight = mesh[164][1] - boxTop;

      // Draw the box a bit larger for debugging purposes
      ctx.beginPath();
      const boxsize = 4;
      ctx.rect(boxLeft-boxsize, boxTop-boxsize, boxWidth+boxsize*2, boxHeight+boxsize*2);
      ctx.stroke();

      // Get the image data from that region
      let bloodRegion = ctx.getImageData(boxLeft, boxTop, boxWidth, boxHeight);

      // Get the area into Tensorflow, then split it and average the green channel
      videoDataSum = bloodRegion.data.reduce((a, b) => a + b, 0);
      videoDataSum -= boxWidth*boxHeight*255; // remove alpha channel
      avgIntensity = videoDataSum/(boxWidth*boxHeight*3);

      // Get FPS of this loop as well
      timingHist.push(1/((performance.now() - last)*.001));
      last = performance.now();

      // Append intensity and FPS to an array and shift it out if too long
      bloodHist.push(bloodHist[maxHistLen-1]*.8 + .2*avgIntensity);
      if (bloodHist.length > maxHistLen){
        bloodHist.shift();
        timingHist.shift();
        
        fftData = await calcFFT(bloodHist);
        updateChart(timingHist,fftData);
        updateChart2(bloodHist);
      }
    }
  }
}

async function calcFFT(data){
    // Remove offset
    const avg = average(data);
    data = data.map(elem => elem-avg);

    // Calculate FFT
    tmp = fft.forward(data);

    // Remove DC term (should be 0 anyway) and return
    return tmp.slice(1);
}


var heartrate = 0;
function updateChart(times, data){
  // Get the bin frequencies from their index
  data = data.map(elem => Math.abs(elem));
  curPollFreq = average(times.slice(Math.round(maxHistLen/2)));
  binNumber = Array.from(data).map((elem, index) => index+1);
  binHz = binNumber.map(elem => elem*curPollFreq/maxHistLen);

  // Find max frequency bin to get the max heartrate
  maxVal = 0
  maxHz = 0;
  maxInd = 0;
  for (let i = 0; i < binHz.length; i++){
    if (binHz[i] > .66 && binHz[i] < 2){ // Constrain heartrates to 40-120 bpm
      if (data[i] > maxVal){
        maxVal = data[i];
        maxHz = binHz[i];
        maxInd = i;
      }
    }
  }

  heartrate += (maxHz-heartrate)*.03;
  document.getElementById('HR_indicator').innerHTML = "Predicted heartrate: " + Math.round(heartrate*60) + " BPM";
  document.getElementById("cameraFPS").innerHTML = "Camera Average FPS: " + Math.round(curPollFreq);


  HzData = Array.from(data).map((elem, index) => [binHz[index]*60, elem]);

  new Dygraph(document.getElementById("graphdiv"),
              HzData,
              {
                labels: ["Bin", "Magnitude"],
                title: "Heartrates vs Magnitude",
                // xlabel: "Frequency (Hz)",
                // ylabel: "Magnitude",
                dateWindow: [30, 140]
              });
  }

function updateChart2(data){
  indexedData = Array.from(data).map((elem, index) => [index+1, elem])

  new Dygraph(document.getElementById("graphdiv2"),
              indexedData,
              {
                labels: ["Index", "Pixel Intensity"],
                // ylabel: "Avg'd Pixel Intensity",
                // xlabel: "Time"
                title: "Pixel Average vs. Time"

              });
}

var canvas;
var ctx;
var fft;
async function main() {
    fmesh = await facemesh.load({maxFaces:1});

    // Set up front-facing camera
    await setupCamera();
    videoWidth = video.videoWidth;
    videoHeight = video.videoHeight;
    video.play()
    
    // Create canvas and drawing context
    canvas = document.getElementById('facecanvas');
    canvas.width = videoWidth/2;
    canvas.height = videoHeight/2;
    ctx = canvas.getContext('2d');

    // Init the FFT objects
    fft = new window.kiss.FFTR(maxHistLen);

    // start prediction loop
    renderPrediction();
}


