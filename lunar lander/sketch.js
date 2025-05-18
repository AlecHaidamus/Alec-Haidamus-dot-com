function makeGround() {
  groundVerts.length  = 0;
  stars.length        = 0;
  landingSpots.length = 0;

  const t           = constrain((difficulty - 1) / 4, 0, 1);   
  const bandTop     = lerp(0.55, 0.20, t);   // from 0.40 to  0.10
  const bandBottom  = lerp(0.7, 0.98, t);   // from 0.80 to 0.95
  const playHeight = (bandBottom - bandTop) * height;
  const steps   = floor(width / terrainDetail);
  const baseY   = height * terrainMid;
  const amp     = height * terrainRange * difficulty;

  const y = new Array(steps + 1);
  for (let i = 0; i <= steps; i++) {
    y[i] = baseY + (noise(i / terrainSmoothness) - 0.5) * amp;
  }

  const delta = y[steps] - y[0];
  for (let i = 0; i <= steps; i++) y[i] -= delta * i / steps;

  let yMin = Math.min(...y),
      yMax = Math.max(...y);
  const currentSpan = yMax - yMin || 1;          // no ÷0
  const targetMid   = height * (bandTop + bandBottom) * 0.5;
  const scale       = playHeight / currentSpan;  

  for (let i = 0; i <= steps; i++)
    y[i] = (y[i] - (yMin + yMax) * 0.5) * scale + targetMid;

  for (let i = 0; i <= steps; i++) {
    if (random() < 1 / starriness) {
      stars.push([i * terrainDetail, random(0, y[i] - height / 10)]);
    }
  }

  const flats = [];
  let i = 0;
  while (i < steps) {
    if (abs(y[i + 1] - y[i]) / terrainDetail < flatSlopeThreshold) {
      const start = i;
      while (
        i < steps &&
        abs(y[i + 1] - y[i]) / terrainDetail < flatSlopeThreshold
      ) i++;
      if (i - start + 1 >= minFlatLength) flats.push([start, i]);
    }
    i++;
  }


  const chosen = [];
  for (let k = 0; k < (constrain(difficulty-1,0,3)) && flats.length; k++) {
    chosen.push(flats[floor((k + 0.5) * flats.length / 3)]);
  }
  i = 0;
  while (i < steps) {
    const run = chosen.find(r => r[0] === i);

    if (run) {
      const [s, e] = run;
      const w    = 28;
      const cx   = ((s + e) * 0.5) * terrainDetail;
      const x0   = cx - w * 0.5;
      const x1   = cx + w * 0.5;
      const yPad = (y[s] + y[e]) * 0.5;

      landingSpots.push([x0, yPad, w]);
      groundVerts.push([x0, yPad], [x1, yPad]);

      i = e + 1;          
    } else {
      groundVerts.push([i * terrainDetail, y[i]]);
      i++;
    }
  }
  groundVerts.push([steps * terrainDetail, y[steps]]);

  groundVerts.unshift(...groundVerts             
      .slice(-WRAP).map(([x, y]) => [x - width, y]));
  groundVerts.push   (...groundVerts             
      .slice( WRAP, 2*WRAP).map(([x, y]) => [x + width, y]));
}


let currBrushScale = 1;                               
function setBrushScale(target){                       
  brush.scale(target / currBrushScale);              
  currBrushScale = target;                            
}

function terrainNormalAt(xWorld) {
  const xWrap = ((xWorld % width) + width) % width;    
  const seg   = floor(xWrap / terrainDetail);            
  const idx   = seg + WRAP;                            

  const [x1, y1] = groundVerts[idx];
  const [x2, y2] = groundVerts[idx + 1];
  return createVector(y1 - y2, x2 - x1).normalize();
}
let sndThrust, sndExplode;

function preload() {
  sndThrust  = loadSound('sound/thruster.wav');
  sndExplode = loadSound('sound/explosion.wav');
}


function getLanderVerts(p, angle) {
  const halfWidth  = 14;   
  const halfHeight = 12;        
  let local = [
    createVector(-halfWidth,-halfHeight), createVector(halfWidth,-halfHeight),
    createVector(halfWidth, halfHeight), createVector(-halfWidth, halfHeight)
  ];
  return local.map(v => {
    let rotLocalX = v.x * cos(angle) - v.y * sin(angle);
    let rotLocalY = v.x * sin(angle) + v.y * cos(angle);
    return createVector(p.x + rotLocalX, p.y + rotLocalY);
  });
}

function groundHeightAt(x) {
  const xWrap = ((x % width) + width) % width;   
  const seg   = floor(xWrap / terrainDetail);    
  const idx   = seg + WRAP;                      
  const [x1, y1] = groundVerts[idx];
  const [x2, y2] = groundVerts[idx + 1];
  const t = (xWrap - seg * terrainDetail) / terrainDetail;
  return lerp(y1, y2, t);
}


let RAW_LANDER_VERTS = [[470,286],[410,325],[414,489],[467,522],[381,526],[386,581],[689,574],[674,520],[590,516],[644,495],[626,305],[579,279],[472,285],[419,324],[412,478],[466,511],[386,521],[386,575],[316,703],[385,579],[393,581],[319,697],[364,698],[281,703],[352,706],[362,698],[330,689],[395,576],[687,569],[666,563],[741,685],[686,571],[736,682],[688,689],[680,695],[764,693],[782,689],[738,675],[671,527],[589,515],[472,517],[389,528],[406,571],[418,609],[650,597],[680,569],[671,529]];


function buildScaledOutline(rawVerts, targetSize) {
  let xs = [], ys = [];
  for (let i = 0; i < rawVerts.length; i++) {
    xs.push(rawVerts[i][0]);
    ys.push(rawVerts[i][1]);
  }

  let minX = min(xs),  maxX = max(xs);
  let minY = min(ys),  maxY = max(ys);

  let centerX = (minX + maxX) / 2;
  let centerY = (minY + maxY) / 2;

  let scaleFactor = targetSize / max(maxX - minX, maxY - minY);

  let out = [];
  for (let i = 0; i < rawVerts.length; i++) {
    let x = (rawVerts[i][0] - centerX) * scaleFactor;
    let y = (rawVerts[i][1] - centerY) * scaleFactor;
    out.push([x, y]);
  }
  return out;
}

function reset () {

  if (lunarModule.exploded) {

    // let tag = "";
    // while (tag.length !== 3) {                       
    //   let ans = prompt("You crashed!\nEnter 3-letter name:", "AAA");
    //   if (ans === null) break;                       
    //   tag = ans.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
    // }
    // console.log("Player tag:", tag || "N/A");       


    points = 0;
    lunarModule.explosionParts = null;
    lunarModule.exploded = false;
    lunarModule.explodedYet = false;
    lunarModule.fuel = 1000;
    difficulty = 1;
    waiting = true
  }

  if (lunarModule.landed) {
    lunarModule.landed = false;
    difficulty += 1;
  }

  bounces = 0;
  lunarModule.pos.set(randomGaussian(width / 3, 10), height / 10);
  lunarModule.rot = randomGaussian(0, difficulty * 10);
  lunarModule.vel.set(initSpeed + difficulty / 9, 0);

  noiseSeed(frameCount);
  makeGround();
}





let currentRotKey = null;
function keyPressed() {
  if (!currentRotKey && keyCode === LEFT_ARROW)  currentRotKey = 'L',waiting=false;
  if (!currentRotKey && keyCode === RIGHT_ARROW) currentRotKey = 'R',waiting=false;
  if (!currentRotKey && keyCode === UP_ARROW)waiting=false;

}
function keyReleased() {
  if (currentRotKey === 'L' && keyCode === LEFT_ARROW)   currentRotKey = null;
  if (currentRotKey === 'R' && keyCode === RIGHT_ARROW)  currentRotKey = null;
}

const WRAP = 20;         
let stars = []
let groundVerts = []
let lunarModule;
let ArduinoFlag = false
let serialOption = false
let serialEnabled = false;

let bounceSpeedThreshold = 0.05;
let explodeSpeedThreshold = 0.5;

let terrainDetail = 18
let terrainSmoothness = 16
let terrainMid   = 0.75;  
let terrainRange = 0.4;   

let starriness = 1.5
let difficulty = 1
let initSpeed = 1.7
let grav = 0.003
let points = 0

let ZOOM = 3                                    
let zoomed   = false                              
let camX = 0, camY = 0                            
let viewDX = 0, viewDY = 0   

let port, latest = "";
let sensor1
let sensor2

let BrushWeight = 0.5
let zoomedBrushScale = 0.2
let unzoomedBrushScale = 0.4

let sensorThresh = 300;    
let sensorMax       = 900;    
let maxRotRate    = 1.0;    

let landingSpots   = [];
const flatSlopeThreshold = 0.2;  
const minFlatLength      = 2;     
const minLandingWidth = 15;
const maxLandingWidth = 50;

let bounces = 0
let landMessage = ''
let waiting = true






   
      

function setup() {

  
  createCanvas(windowWidth, windowHeight,WEBGL);
  angleMode(DEGREES)
  rectMode(CENTER)
  makeGround()
  print(landingSpots)
  brush.set("cpencil", "#FFFFFF", 2)
  font = loadFont("TRJNDaVinci-Thin-Trial.ttf")
  brush.scaleBrushes(unzoomedBrushScale)
  brush.strokeWeight(BrushWeight)
  textFont(font)
  textSize(30)
  textAlign(CENTER)



if (serialOption){
if (confirm("Connect to Arduino via serial?")) {
  serialEnabled = true;
  port = createSerial();
  let up = usedSerialPorts();
  if (up.length) port.open(up[0], 9600);
} else {
  serialEnabled = false;
}
}


sndThrust.setVolume(0.4,1)
sndExplode.setVolume(0.15)


         
  landerVerts = buildScaledOutline(RAW_LANDER_VERTS, 30);
  lunarModule = {
    pos: createVector(randomGaussian(width/3,10),height/10),
    vel: createVector(initSpeed,0),
    rot: randomGaussian(randomGaussian(0,difficulty*10)),
    thrust:0.007,
    rotSpeed:1,
    fire:false,
    fuel: 1000,
    exploded: false,
    landed: false,
    explosionParts: null,
    explodedYet: false,

    

    show: function() {
  let c = cos(this.rot),
        s = sin(this.rot),
        px = this.pos.x,
        py = this.pos.y;

if (this.exploded) {
  if (!this.explodedYet) {         
    sndExplode.play();
    sndThrust.stop();
    this.explodedYet = true;
  }
  if (!this.explosionParts) {
    this.explosionParts = [];
    let c = cos(this.rot), s = sin(this.rot);
    let px = this.pos.x,   py = this.pos.y;

    for (let i = 0; i < landerVerts.length - 1; i++) {
      let [lx1, ly1] = landerVerts[i];
      let [lx2, ly2] = landerVerts[i + 1];
      let wx1 = px + lx1 * c - ly1 * s;
      let wy1 = py + lx1 * s + ly1 * c;
      let wx2 = px + lx2 * c - ly2 * s;
      let wy2 = py + lx2 * s + ly2 * c;

      let center = createVector((wx1 + wx2) * 0.5, (wy1 + wy2) * 0.5);
      let rel1   = createVector(wx1 - center.x, wy1 - center.y);
      let rel2   = createVector(wx2 - center.x, wy2 - center.y);

      let dir = p5.Vector.sub(center, this.pos).normalize();
      let speed = random(1, 3);
      let vel = dir.mult(speed);

      this.explosionParts.push({ center, rel1, rel2, vel });
    }
  }

  brush.stroke("#FFFFFF");
  for (let part of this.explosionParts) {
    part.center.add(part.vel);
    let x1 = part.center.x + part.rel1.x - viewDX;
    let y1 = part.center.y + part.rel1.y - viewDY;
    let x2 = part.center.x + part.rel2.x - viewDX;
    let y2 = part.center.y + part.rel2.y - viewDY;
    brush.line(x1, y1, x2, y2);
  }
  return;
}




  brush.stroke("#FFFFFF");
  for (let i = 0; i < landerVerts.length - 1; i++) {
    let [lx1, ly1] = landerVerts[i],
        [lx2, ly2] = landerVerts[i + 1];
    let wx1 = px + lx1 * c - ly1 * s - viewDX,
        wy1 = py + lx1 * s + ly1 * c - viewDY;
    let wx2 = px + lx2 * c - ly2 * s - viewDX,
        wy2 = py + lx2 * s + ly2 * c - viewDY;
    brush.line(wx1, wy1, wx2, wy2);
  }


  if (this.fire && !this.landed) {
    brush.seed(random(1,100))
    const nozX = px - 11 * sin(this.rot) - viewDX;
    const nozY = py + 11 * cos(this.rot) - viewDY;
  
    const dirX = -sin(this.rot), dirY =  cos(this.rot);   
    const pX   =  dirY,           pY   = -dirX;           
  
    const L = 20;               
    const W =  2.5;                

    brush.strokeWeight(BrushWeight * 2);
    brush.stroke(color('hsl(40, 20%, 100%)'))                        
    brush.line(nozX, nozY,
               nozX + dirX * L * 0.7, nozY + dirY * L * 0.7);
  
    brush.strokeWeight(BrushWeight * 10);
    brush.stroke(255,random(40,150),random(40,50))                          
    brush.line(nozX + pX * W, nozY + pY * W,             
               nozX + dirX * L,   nozY + dirY * L);
    brush.line(nozX - pX * W, nozY - pY * W,             
               nozX + dirX * L,   nozY + dirY * L);
  
    brush.seed("moon")
    brush.stroke("#FFFFFF");
    brush.strokeWeight(BrushWeight);    
    
    if (!sndThrust.isPlaying() ) sndThrust.loop();
    sndThrust.setVolume(0.4,0.01)
  } else {
    if (sndThrust.isPlaying())
    sndThrust.setVolume(0, 0.01)
    ;
  }


},



update: function () {
  if (this.landed || this.exploded) {
    return;
  }

  this.fire = false;
  this.vel.y += grav;
  this.pos.add(this.vel);

  let landerVerts = getLanderVerts(this.pos, this.rot);

  let hit = false, hitNormal;
  let centerHit = false;
  

let anyNormal    = null;   // first segment touched – fallback
let centerNormal = null;   // segment whose x–span contains the CM

for (let i = 0; i < groundVerts.length - 1; i++) {
  const [x1, y1] = groundVerts[i];
  const [x2, y2] = groundVerts[i + 1];

  if (collideLinePoly(x1, y1, x2, y2, landerVerts)) {
    hit = true;
    const n = createVector(y1 - y2, x2 - x1).normalize();
    if (!anyNormal) anyNormal = n;
    if (this.pos.x >= min(x1, x2) && this.pos.x <= max(x1, x2)) {
      centerNormal = n;
      break;                        
    }
  }
}

if (hit) hitNormal = centerNormal ? centerNormal : anyNormal;


  if (hit) {
    const groundN = terrainNormalAt(this.pos.x);             
const upX =  sin(this.rot),   upY = -cos(this.rot);       
const tiltOK = abs(upX*groundN.x + upY*groundN.y) > 0.9848; 

    


  let speed = this.vel.mag();
  if (speed < bounceSpeedThreshold&& tiltOK) { //lands
    this.vel.set(0, 0);
    this.landed = true;

    let onPad = false
    for (let i = 0; i<landingSpots.length;i++){
      if(lunarModule.pos.x>landingSpots[i][0]&&lunarModule.pos.x<(landingSpots[i][0]+landingSpots[i][2])){onPad = true}

    }
    
    let pts    = 0;
    let msg    = "";
    
    if (ceil(this.fuel) === 0) {
      pts = 10;
      msg = "landed with no fuel\n10 points";
    } else if (bounces <= 1) {
      pts = 5;
      msg = "perfect landing\n5 points";
    } else if (bounces < 4) {
      pts = 3;
      msg = "great landing\n3 points";
    } else {
      pts = 2;
      msg = "you landed\n2 points";
    }
    
    if (onPad) {
      pts *= 2;
      msg += "\nBONUS x2";
    }
    
    points      += pts;
    landMessage  = msg;

    const timeOut = setTimeout(reset,3000)

  }
    
        
  else if (speed < explodeSpeedThreshold&& tiltOK) { //bounces
    let dot = this.vel.dot(hitNormal);
    bounces += 1
    
    this.vel
      .sub(p5.Vector.mult(hitNormal, 2 * dot))
      .mult(0.8);
  }
  else { //explodes
    this.exploded = true;

    if (points==0){const timeOut = setTimeout(reset,2000)}
    else{const timeOut = setTimeout(reset,5000)}
  }
}


  if (this.pos.x > width)  this.pos.x = 0;
  if (this.pos.x < 0)      this.pos.x = width;


  if (ArduinoFlag) {
    let t1 = max(0, (sensor1 - sensorThresh) / (sensorMax - sensorThresh));
    let t2 = max(0, (sensor2 - sensorThresh) / (sensorMax - sensorThresh));
  
    if (t1 > 0 && t2 === 0) {
      this.rot -= t1 * maxRotRate;
    }
    else if (t2 > 0 && t1 === 0) {
      this.rot += t2 * maxRotRate;
    }
    else if (t1 > 0 && t2 > 0) {
      let thrustScale = min(t1, t2);  
      this.vel.add(
        cos(this.rot - 90) * this.thrust * thrustScale,
        sin(this.rot - 90) * this.thrust * thrustScale
      );
      this.fire = true;
    }
  } else {
    if (keyIsDown(UP_ARROW) && this.fuel > 0) {
      this.vel.add(
        cos(this.rot - 90) * this.thrust,
        sin(this.rot - 90) * this.thrust
      );
      this.fuel -= 0.2;
      this.fire  = true;
    }
    if (keyIsDown(LEFT_ARROW) && !keyIsDown(RIGHT_ARROW)) this.rot -= this.rotSpeed;
    else if (keyIsDown(RIGHT_ARROW) && !keyIsDown(LEFT_ARROW)) this.rot += this.rotSpeed;
  }
  
  
}



  }
}



function draw() {


if (serialEnabled && port && port.opened()) {
  let s = port.readUntil("\n");
  if (s.length) latest = s;
  ArduinoFlag = true;
} else {
  ArduinoFlag = false;
}


if (latest) {
  let parts = split(trim(latest), ",");
  if (parts.length >= 2) {
    sensor1 = constrain(Number(parts[0]), 0, sensorMax);
    sensor2 = constrain(Number(parts[1]), 0, sensorMax);
  }
}


  translate(-width/2,-height/2)

  let groundY       = groundHeightAt(lunarModule.pos.x);   
  let distToGround  = groundY - lunarModule.pos.y;         

  if (!zoomed && distToGround < 60) {       
    zoomed = true;
    camX   = lunarModule.pos.x;             
    camY   = lunarModule.pos.y;
        brush.scaleBrushes(zoomedBrushScale/unzoomedBrushScale)

    setBrushScale(ZOOM);                     

  } else if (zoomed && distToGround > 120) { 
    zoomed = false;
        brush.scaleBrushes(unzoomedBrushScale/zoomedBrushScale)

    setBrushScale(1);                       


  }


if (zoomed) {
  const halfW = width  / (2 * ZOOM);
  const halfH = height / (2 * ZOOM);
  const marginX = halfW * 0.8;
  const marginY = halfH * 0.8;

  if (lunarModule.pos.x - camX >  marginX)
      camX = lunarModule.pos.x - marginX;
  if (lunarModule.pos.x - camX < -marginX)
      camX = lunarModule.pos.x + marginX;

  if (lunarModule.pos.y - camY >  marginY)
      camY = lunarModule.pos.y - marginY;
  if (lunarModule.pos.y - camY < -marginY)
      camY = lunarModule.pos.y + marginY;

  viewDX = camX - halfW;
  viewDY = camY - halfH;
} else {
  viewDX = viewDY = 0;
}



  clear()
  // background(0)
  brush.seed("Moon")
  stroke(255)
  fill(255)


  if (waiting){

    text("Welcome to Lunar lander"+"\n"+"play with the arrow keys",width/2,height/2)
    for (let i = 0; i < stars.length; i++){brush.circle(stars[i][0]-viewDX, stars[i][1]-viewDY, 1, true)}
      for (let i = 0; i < groundVerts.length-1; i++){
        brush.seed(`${i}`)
        brush.line(groundVerts[i][0]-viewDX, groundVerts[i][1]-viewDY,
                   groundVerts[i+1][0]-viewDX, groundVerts[i+1][1]-viewDY)  
      }}

  else{

  for (let i = 0; i < stars.length; i++){
    brush.circle(stars[i][0]-viewDX, stars[i][1]-viewDY, 1, true);   
  }

    for (let i = 0; i < groundVerts.length-1; i++){
      brush.seed(`${i}`)
      brush.line(groundVerts[i][0]-viewDX, groundVerts[i][1]-viewDY,
                 groundVerts[i+1][0]-viewDX, groundVerts[i+1][1]-viewDY)  
    }

  lunarModule.update()
  lunarModule.show()



for (let i= 0; i<landingSpots.length;i++){

  // brush.circle(landingSpots[i][0]-viewDX,landingSpots[i][1]-viewDY,5)
  // brush.circle((landingSpots[i][0]+landingSpots[i][2])-viewDX,landingSpots[i][1]-viewDY,5)
  if(zoomed){
    textSize(12)
  push()
    scale(ZOOM)
    text("x2",landingSpots[i][0] +15 - viewDX,landingSpots[i][1] +22 - viewDY)
  pop()
  }
  
  else{
    textSize(20)
    text("x2",landingSpots[i][0]+15,landingSpots[i][1]+20)}
}

textSize(30)
text(sensor1,width/2,40)
text(sensor2,width/2,80)

text(ceil(lunarModule.fuel)+" fuel",70,40)
text(points+" points",width-80,40)



  if(lunarModule.exploded){

    if (points>0){text('You have passed away'+"\n"+"you got "+points+"points",(width/2),height/3)}
    else{text('You have passed away',(width/2),height/3)}
    
  }
  else if(lunarModule.landed){text(landMessage, (width/2), height/3)}
  else if(ceil(lunarModule.fuel)==0){text("no more fuel", (width/2), height/3)}

}}

