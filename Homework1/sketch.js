const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Composite = Matter.Composite;
const Events = Matter.Events;

let canvas;

let engine;
let world;

let dropBall;
let leftBall;

// 모빌 흔들림
let swayAngle = 0;
let swayVelocity = 0;

// 세로 막대의 별도 흔들림
let verticalAngle = 0;
let verticalVelocity = 0;

// 상태
let hasDropped = false;
let isHit = false;

const green = "#064442";
const teal = "#27939B";
const orange = "#F5A313";
const lineColor = "#B7AD98";


//////////////////////////// SETUP
function setup() {
  canvas = createCanvas(windowWidth, windowHeight);

  // Matter
  engine = Engine.create();
  world = engine.world;

  // 중력
  engine.gravity.x = 0;
  engine.gravity.y = 2;
  engine.gravity.scale = 0.001;

  // 물리 안정화
  engine.positionIterations = 10;
  engine.velocityIterations = 8;
  engine.constraintIterations = 8;


  // Matter 벽
  const margin = 20;
  const floorY = height * 0.84;

  Composite.add(engine.world, [

    // 왼쪽 벽
    Bodies.rectangle(
      -margin / 2,
      height / 2,
      margin,
      height,
      {
        isStatic: true
      }
    ),

    // 오른쪽 벽
    Bodies.rectangle(
      width + margin / 2,
      height / 2,
      margin,
      height,
      {
        isStatic: true
      }
    ),

    // 바닥
    Bodies.rectangle(
      width / 2,
      floorY + 10,
      width,
      20,
      {
        isStatic: true,
        restitution: 0.2,
        friction: 0.5
      }
    )
  ]);

  // 좌표
  const jointX = width / 2 + 180;
  const jointY = height / 2;
  const leftX = width / 2 - 370;
  const leftY = jointY;

  // 떨어지는 빨간 공
  dropBall = Bodies.circle(
    leftX,
    height * 0.05,
    15,
    {
      density: 0.02,
      friction: 0.1,
      frictionAir: 0.005,
      restitution: 0.2
    }
  );

  // 왼쪽 큰 공
  leftBall = Bodies.circle(
    leftX,
    leftY,
    60,
    {
      isStatic: true,
      restitution: 0.4
    }
  );

  // World
  Composite.add(
    world,
    [
      dropBall,
      leftBall
    ]
  );

  // 충돌 감지
  Events.on(
    engine,
    "collisionStart",
    function(event) {

      event.pairs.forEach(
        function(pair) {

          const bodyA = pair.bodyA;
          const bodyB = pair.bodyB;

          const hit =
            (bodyA === dropBall &&
             bodyB === leftBall)
            ||
            (bodyB === dropBall &&
             bodyA === leftBall);

          if (hit && !isHit) {
            isHit = true;
            // 왼쪽이 먼저 내려가는 방향
            swayVelocity = -0.009;
            // 세로 부분도 살짝 반응
            verticalVelocity = -0.002;
          }
        }
      );
    }
  );
}

//////////////////////////////////// DRAW
function draw() {

  background(255);

  // Matter 계산
  Engine.update(engine);

  // 모빌 흔들림 계산
  updateSway();

  // 그리기
  drawFloor();
  drawStand();
  drawMobile();

  // 떨어지는 빨간 공
  if (!hasDropped) {
    noStroke();
    fill("#D94A3A");
    ellipse(
      dropBall.position.x,
      dropBall.position.y,
      30,
      30
    );
  }
}

// 모빌 흔들림
function updateSway() {

  // 가로 막대
  const spring = 0.0002;
  const damping = 0.99;

  // 원래 위치로 돌아가는 힘
  swayVelocity +=
    -swayAngle * spring;

  // 감쇠
  swayVelocity *= damping;

  // 회전
  swayAngle += swayVelocity;

  // 최대 회전각
  const maxAngle = radians(20);

  // 세로 막대
  const verticalSpring = 0.00035;
  const verticalDamping = 0.985;

  // 가로 막대가 움직이면 세로 막대도 조금 늦게 따라감
  verticalVelocity +=
    (swayAngle - verticalAngle)
    * verticalSpring;
  verticalVelocity *= verticalDamping;
  verticalAngle += verticalVelocity;

  // 세로 막대는 조금만 움직이게
  const verticalMax = radians(30);
}


// 모빌
function drawMobile() {
  // 기본 좌표
  const jointX = width / 2 + 180;
const jointY = height / 2;

const leftX = width / 2 - 370;
const leftY = jointY;

const topY = jointY - 200;
const bottomY = jointY + 90;


  // 원 크기
  const leftRadius = 60;
  const topRadius = 18;
  const bottomRadius = 30;

  // 가로 막대의 회전축
  const pivotX = jointX - 180;
  const pivotY = jointY;

  // 가로 막대 회전

  const left = rotatePoint(
    leftX,
    leftY,
    pivotX,
    pivotY,
    swayAngle
  );

  const joint = rotatePoint(
    jointX,
    jointY,
    pivotX,
    pivotY,
    swayAngle
  );

  // 세로 막대
  const topLength = jointY - topY;
  const bottomLength = bottomY - jointY;


  // 세로 막대의 방향
  const vx = sin(verticalAngle);
  const vy = cos(verticalAngle);

  // 위쪽 끝
  const top = {
    x: joint.x + vx * topLength,
    y: joint.y - vy * topLength
  };

  // 아래쪽 끝
  const bottom = {
    x: joint.x - vx * bottomLength,
    y: joint.y + vy * bottomLength
  };

  // 선
  stroke(lineColor);
  strokeWeight(2);
  strokeCap(SQUARE);

  // 가로선
  line(
    left.x,
    left.y,
    joint.x,
    joint.y
  );

  // 세로선
  line(
    top.x,
    top.y,
    bottom.x,
    bottom.y
  );

  // 왼쪽 공
  noStroke();
  fill(teal);
  ellipse(
    left.x,
    left.y,
    leftRadius * 2.2,
    leftRadius * 2.2
  );


  // 초록공
  fill(green);
  ellipse(
    top.x,
    top.y,
    topRadius * 1.8,
    topRadius * 1.8
  );

  // 주황공
  fill(orange);
  ellipse(
    bottom.x,
    bottom.y,
    bottomRadius * 2,
    bottomRadius * 2
  );
}

// 회전
function rotatePoint(
  x,
  y,
  centerX,
  centerY,
  angle
) {
  const dx = x - centerX;
  const dy = y - centerY;
  return {
    x:
      centerX +
      dx * cos(angle) -
      dy * sin(angle),
    y:
      centerY +
      dx * sin(angle) +
      dy * cos(angle)
  };
}

// 삼각형 받침대
function drawStand() {
  const jointX = width / 2 + 180;
  const jointY = height / 2;
  const floorY = height * 0.84;
  const triangleWidth = 90;
  const triangleX = jointX - 180;

  noStroke();
  fill(green);
  triangle(
    triangleX,
    jointY,
    triangleX - triangleWidth / 2,
    floorY,
    triangleX + triangleWidth / 2,
    floorY
  );
}

// 바닥
function drawFloor() {
  const floorY = height * 0.84;
  noStroke();
  fill("#E8E5DE");
  rect(
    0,
    floorY,
    width,
    height - floorY
  );
}


// 화면 크기
function windowResized() {

  resizeCanvas(
    windowWidth,
    windowHeight
  );

}