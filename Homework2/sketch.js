const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Composite = Matter.Composite;

const green = "#064442";
const teal = "#27939B";
const orange = "#F5A313";
const lineColor = "#B7AD98";

// 기본 변수
let canvas;
let engine;
let world;
let umbrellaX;
let umbrellaY;
let ground;

// 우산 크기
const umbrellaW = 200;
const umbrellaH = 170;

// 우산 천 접기 애니메이션
let umbrellaProgress = 0;
let umbrellaState = "normal";
let sweepMode = false;

let foldSpeed = 0.025;
let unfoldSpeed = 0.12;

// 우산 드래그
let isDragging = false;
let startMouseX;
let startMouseY;
let sweepAngle = 0;

// 삼각형 밑변
const foldedWidth = 25;
const foldedBottomY = -15;

// 비
let raindrops = [];
const rainSize = 8;
const rainInterval = 2;

//바닥 쓸기
const groundHeight = 80;
const sweepHeight = 100; //우산이 이 높이까지 내려오면 쓸기 가능
const sweepPower = 0.0006; //쓰는 힘

//바람
let windForce = 0;
//우산의 이전 위치
let previousUmbrellaX = 0;
//바람의 세기
let windStrength = 0.0000015;

//펼쳐질 때 팡 효과
let popPower = 0.01;
let popRadius = 500;

// 실제 우산 충돌체
let umbrellaBodies = [];
// 우산 곡선을 구성할 충돌체 개수
const umbrellaBodyCount = 17;
// 충돌체 크기
const umbrellaBodyRadius = 10;


////////////////////////////////// setup
function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  engine = Engine.create();
  world = engine.world;
  engine.gravity.y = 1;
  //바닥
  ground = Bodies.rectangle(
  width / 2, height - 40, width, 80, {
    isStatic: true,
    restitution: 0,
    friction: 0.1,
    label: "ground"
  }
);
Composite.add(world, ground);

  // 우산 위치
  umbrellaX = width / 2;
  umbrellaY = height / 2;
  previousUmbrellaX = umbrellaX;

  // 실제 우산 충돌체 생성
  createUmbrellaBodies();
}

/////////////////////////////////// draw
function draw() {

  background(teal);

  fill(lineColor);
  noStroke();
  rect(
  0,
  height - 80,
  width,
  80
  );
  // 실제 우산 충돌체 위치 업데이트
  updateUmbrellaBodies();
  // Matter.js 물리 업데이트
  Engine.update(engine);

  // 비
  createRain();
  updateRain();
  drawRain();

  // 우산 애니메이션
  updateUmbrella();
  drawUmbrella(umbrellaX, umbrellaY);
}

// 실제 우산 충돌체 생성
function createUmbrellaBodies() {
  for (let i = 0;
    i < umbrellaBodyCount;
    i++
  ) {
    let body = Bodies.circle(
        umbrellaX,
        umbrellaY,
        umbrellaBodyRadius,
        {
          isStatic: true,
          restitution: 0,
          friction: 0.1,
          label: "umbrella"
        }
      );
    umbrellaBodies.push(body);
    Composite.add(world, body);
  }
}

function updateUmbrellaBodies() {

  // 평소 우산
  if (umbrellaProgress === 0) {
    for (
      let i = 0;
      i < umbrellaBodyCount;
      i++
    ) {
      let t = i / (umbrellaBodyCount - 1);
      let normalizedX = t * 2 - 1;
      // 우산의 좌우 위치
      let x = normalizedX * umbrellaW / 2;
      // 반원 곡선
      let y = -umbrellaH / 2 * sqrt(max(0, 1 - normalizedX * normalizedX));
      Body.setPosition(
        umbrellaBodies[i], {
          x: umbrellaX + x,
          y: umbrellaY + y
        }
      );
      Body.setVelocity(umbrellaBodies[i], {
          x: 0,
          y: 0
        }
      );
    }
  }

  // 접힌 우산
  else {
    let currentWidth =
      lerp(umbrellaW, 40, umbrellaProgress);
    let currentBottomY =
      lerp(0, 110, umbrellaProgress);
    let topY = -umbrellaH / 2;
    for (
      let i = 0;
      i < umbrellaBodyCount;
      i++
    ) {
      let t = i / (umbrellaBodyCount - 1);
      let sensorX;
      let sensorY;
      // 왼쪽 경사면
      if (t <= 0.5) { 
        let sideT = t * 2;
        if (!sweepMode) {
          // 평소 접힌 모양
          // 밑변 → 위쪽 꼭짓점
          sensorX = lerp(-currentWidth / 2, 0, sideT);
          sensorY = lerp(currentBottomY, topY, sideT);
        } else {
          // 바닥 쓸기 모양
          // 위쪽 밑변 → 아래쪽 꼭짓점
          sensorX = lerp(-currentWidth / 2, 0, sideT);
          sensorY = lerp(topY, currentBottomY, sideT);
        }
      }
      // 오른쪽 경사면
      else {
        let sideT = (t - 0.5) * 2;
        if (!sweepMode) {
          // 평소 접힌 모양
          sensorX = lerp(0, currentWidth / 2, sideT);
          sensorY = lerp(topY, currentBottomY, sideT);
        } else {
          // 바닥 쓸기 모양
          sensorX = lerp(0, currentWidth / 2, sideT);
          sensorY = lerp(currentBottomY, topY, sideT);
        }
      }

      // Matter.js 실제 충돌체 이동
      Body.setPosition( umbrellaBodies[i], {
          x: umbrellaX + sensorX,
          y: umbrellaY + sensorY
        }
      );
      Body.setVelocity( umbrellaBodies[i], {
          x: 0,
          y: 0
        }
      );
    }
  }
}

// 비 생성
function createRain() {
  if (frameCount % rainInterval !== 0) {return;}

  let rain = Bodies.circle(
      random(width),
      -rainSize,
      rainSize / 2, {
        restitution: 0.5,
        friction: 0,
        frictionAir: 0,
        density: 0.001,
        label: "raindrop"
      }
    );

  Composite.add(world, rain);
  raindrops.push(rain);
}

// 비 업데이트
function updateRain() {
  for (
    let i = raindrops.length - 1;
    i >= 0;
    i--
  ) {
    let rain = raindrops[i];
    // 화면 밖으로 나갔는지 확인
    let outside =
      rain.position.y > height + rainSize ||
      rain.position.y < -rainSize ||
      rain.position.x < -rainSize ||
      rain.position.x > width + rainSize;
    // 화면 밖이면 삭제
    if (outside) {
      Composite.remove(world, rain);
      raindrops.splice(i, 1);
    }
  }
}

// 비 그리기
function drawRain() {
  stroke(255);
  strokeWeight(3);
  strokeCap(ROUND);
  for (let rain of raindrops) {
    line(
      rain.position.x,
      rain.position.y,
      rain.position.x,
      rain.position.y + 15
    );
  }
}

// 우산 천 애니메이션
function updateUmbrella() {
  // 접히는 중
  if (umbrellaState === "folding") {
    umbrellaProgress +=
      foldSpeed;
    if (umbrellaProgress >= 1) {
  umbrellaProgress = 1;
  // 완전히 접힌 순간 팡!
  popRain();
  // 바로 펼치기
  umbrellaState =
    "unfolding";
}
  }

  // 빠르게 펼쳐짐
  else if (umbrellaState === "unfolding") {
    umbrellaProgress -=
      unfoldSpeed;
    if (umbrellaProgress <= 0) {
      umbrellaProgress = 0;
      umbrellaState = "normal";
    }
  }
}

// 우산 펼쳐질 때 빗방울 팡!
function popRain() {
  for (let rain of raindrops) {
    // 우산 중심에서 비까지의 거리
    let dx = rain.position.x - umbrellaX;
    let dy = rain.position.y - umbrellaY;
    let distance = sqrt(dx * dx + dy * dy);
    // 우산 반원보다 위쪽에 있는 비만
    if (rain.position.y < umbrellaY && distance < popRadius) {
      // 중심에서 바깥쪽으로 향하는 방향
      let directionX = 0;
      let directionY = 0;
      if (distance > 0) {
        directionX = dx / distance;
        directionY = dy / distance;
      }
      // 가까울수록 강하게
      let strength = map(
          distance,
          0,
          popRadius,
          popPower,
          popPower * 0.2
        );
      // 바깥쪽으로 밀기
      Body.applyForce(rain, rain.position, {
          x: directionX * strength,
          y: directionY * strength
        }
      );
    }
  }
}

// 우산 그리기
function drawUmbrella(x, y) {
  // 바닥 가까이 있는지 확인
  let nearGround = y > height - groundHeight - sweepHeight;
  sweepMode = nearGround;
  push();
  translate(x, y);

  // 바닥 쓸기 모드
  // 클릭했을 때 완전히 접힌 모양을 그대로 유지하면서 135도 회전
  if (sweepMode) {rotate(sweepAngle);}

  // 손잡이
  stroke(green);
  strokeWeight(4);
  strokeCap(ROUND);
  noFill();
  // 세로 손잡이
  line(0, 0, 0, 125);
  // 작은 반원 손잡이
  arc(-10, 125, 20, 20, 0, PI);
  // 우산 천
  noStroke();
  fill(orange);

  // 바닥 쓸기 모드
  // 완전히 접힌 삼각형으로 고정
  if (sweepMode) {
    let currentWidth = 40;
    let currentBottomY = 110;
    let topY = -umbrellaH / 2;

    triangle(
      // 왼쪽 밑변
      -currentWidth / 2, currentBottomY,
      // 오른쪽 밑변
      currentWidth / 2, currentBottomY,
      // 위쪽 꼭짓점
      0, topY
    );
  }

  // 평소 펼쳐진 우산
  else if (umbrellaProgress === 0) {
    arc(
      0,
      0,
      umbrellaW,
      umbrellaH,
      PI,
      TWO_PI,
      CHORD
    );
  }

  // 클릭해서 접히는 중
  else {
    let currentWidth = lerp(umbrellaW, 40, umbrellaProgress);
    let currentBottomY = lerp(0, 110, umbrellaProgress);
    let topY = -umbrellaH / 2;
    triangle(
      // 왼쪽 밑변
      -currentWidth / 2, currentBottomY,
      // 오른쪽 밑변
      currentWidth / 2, currentBottomY,
      // 위쪽 꼭짓점
      0, topY
    );
  }
  // 우산 꼭지
  fill(green);
  circle(0, -umbrellaH / 1.9, 8);

  pop();
}

// 마우스 클릭
function mousePressed() {
  let distance = dist(
      mouseX, mouseY,
      umbrellaX, umbrellaY
    );

  // 우산을 눌렀을 때
  if (distance < umbrellaW / 2) {
    startMouseX = mouseX;
    startMouseY = mouseY;
    isDragging = false;
  }
}

// 마우스 드래그
function mouseDragged() {

  let distanceMoved =
    dist(
      mouseX,
      mouseY,
      startMouseX,
      startMouseY
    );
  // 일정 거리 이상 움직이면 드래그
  if (distanceMoved > 5) {
    isDragging = true;
    // 우산 이동 거리
    let dx = mouseX - umbrellaX;
    let dy = mouseY - umbrellaY;
    // 우산 이동
    umbrellaX = mouseX;
    umbrellaY = mouseY;

    // 바람
    windForce =
      constrain(dx * windStrength, -0.003, 0.003);

    // 바닥 근처인지 확인
    let nearGround =
      umbrellaY > height - groundHeight - sweepHeight;
    sweepMode = nearGround;
    if (nearGround && abs(dx) > 3) {
    // 왼쪽으로 드래그
    if (dx < 0) {sweepAngle = radians(135);}
    // 오른쪽으로 드래그
    else {sweepAngle = radians(-135);}
  }

    // 바닥 근처에서 좌우로 문지르기
    if (nearGround && abs(dx) > 3) {sweepRain(dx);}

    // 기존 바람
    else {
      for (let rain of raindrops) {
        Body.applyForce(rain, rain.position, {
            x: windForce,
            y: 0
          }
        );
      }
    }
  }
}

// 바닥에서 비 쓸어버리기
function sweepRain(dx) {
  for (
    let i = raindrops.length - 1;
    i >= 0;
    i--
  ) {
    let rain = raindrops[i];

    // 우산과 빗방울 거리
    let distance =
      dist(
        rain.position.x,
        rain.position.y,
        umbrellaX,
        umbrellaY
      );
    // 우산 가까이에 있는 비만
    if (distance < 100) {

      // 우산이 움직인 방향으로 밀기
      let direction = dx > 0 ? 1 : -1;

      Body.applyForce(rain, rain.position, {
          x: direction * sweepPower,
          y: 0
        }
      );

      // 화면 밖으로 밀려나면 삭제
      if (
        rain.position.x < -rainSize * 2 ||
        rain.position.x > width + rainSize * 2
      ) {
        Composite.remove(world, rain);
        raindrops.splice(i, 1);
      }
    }
  }
}

// 마우스 놓기
function mouseReleased() {
  // 움직이지 않고 클릭만 했다면
  if (!isDragging) {
    if (
      umbrellaState === "normal") {
      umbrellaState = "folding";
    }
  }
  isDragging = false;
}

// 화면 크기 변경
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  umbrellaX = width / 2;
  umbrellaY = height / 2;
}