
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
    const facepred = await fmesh.estimateFaces(video);
    ctx.drawImage(video, 0, 0, canvas.width,  canvas.height);


    if (facepred.length > 0) { // If we find a face, process it  
      curFaces = facepred;

      for (face of curFaces){
        drawFace(face);
      }
    }
    
    requestAnimationFrame(renderPrediction);
};



// Draws the current eyes onto the canvas, directly from video streams
async function drawFace(face){
  drawEyesBig(face);
  drawLipsBig(face);
}

function drawEyesBig(face){
    let mesh = face.scaledMesh;
    
    // left eye TL, BR: 27/130, 23/243
    let lTop = mesh[27][1];
    let lLeft = mesh[130][0];
    let lBot = mesh[23][1];
    let lRig = mesh[243][0];
    let lWid = lRig-lLeft;
    let lHei = lBot-lTop;

    // right eye TL, BR: 257/463, 253/359
    let rTop = mesh[257][1];
    let rLeft = mesh[463][0];
    let rBot = mesh[253][1];
    let rRig = mesh[359][0];
    let rWid = rRig-rLeft;
    let rHei = rBot-rTop;

    // Draw right eye on left eye, and reverse
    ctx.drawImage(video, rLeft, rTop, rWid, rHei,
                          rLeft + rWid*.05 - rWid*.5, rTop - rHei*.5, 2*rWid, 2*rHei);
    ctx.drawImage(video, lLeft, lTop, lWid, lHei,
                          lLeft - lWid*.05 - lWid*.5, lTop - lHei*.5, 2*lWid, 2*lHei);
}

function drawLipsBig(face){
    // Get lip edges from annotation
    Xs = face.annotations.lipsUpperOuter.map(elem => elem[0])
    TopYs = face.annotations.lipsUpperOuter.map(elem => elem[1])
    BotYs = face.annotations.lipsLowerOuter.map(elem => elem[1])

    lipRight = Math.max(...Xs);
    lipLeft = Math.min(...Xs);
    lipTop = Math.min(...TopYs);
    lipBot = Math.max(...BotYs);
    lipWid = lipRight-lipLeft;
    lipHei = lipBot-lipTop;
    
    let lips = ctx.getImageData(lipLeft-lipWid*.05, lipTop-lipHei*.05, 
                                 lipWid+lipWid*.1, lipHei + lipHei*.1);
    lipsUpsideDown = tf.browser.fromPixels(lips,4).reverse(0);
    
    lips2x = tf.image.resizeBilinear(lipsUpsideDown, [lipsUpsideDown.shape[0]*2, lipsUpsideDown.shape[1]*2]);
    lips2x = lips2x.asType("int32");

    tmpIm = new ImageData(lips2x.shape[1],lips2x.shape[0]);
    tmpIm.data.set(lips2x.dataSync());

    ctx.putImageData(tmpIm, Math.round(lipLeft-tmpIm.width*.25), Math.round(lipTop-tmpIm.height*.25));

    // Clean up the memory from our tensorflow matrices
    lipsUpsideDown.dispose();
    lips2x.dispose();
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
    
    canvas = document.getElementById('facecanvas');
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    ctx = canvas.getContext('2d');

    renderPrediction();
}


