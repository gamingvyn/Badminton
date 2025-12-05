// physics.js - Advanced shuttle, hit, and movement physics
// Provides realistic drag, gravity, bounce, angle control, and collision helpers.

export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  scale(f) {
    this.x *= f;
    this.y *= f;
    return this;
  }
  clone() {
    return new Vector2(this.x, this.y);
  }
}

// ------------------------------------------
// Shuttle Physics
// ------------------------------------------
export class ShuttlePhysics {
  constructor() {
    this.position = new Vector2(0, 0);
    this.velocity = new Vector2(0, 0);

    this.gravity = 0.45;            // downward acceleration
    this.drag = 0.992;              // air resistance
    this.maxFallSpeed = 18;

    this.netX = 640;                // match court size (adjust later)
    this.netHeight = 240;

    this.courtTop = 80;
    this.courtBottom = 680;
    this.courtLeft = 80;
    this.courtRight = 1200;
  }

  // Reset shuttle for a new serve
  reset(x, y) {
    this.position.x = x;
    this.position.y = y;
    this.velocity.x = 0;
    this.velocity.y = 0;
  }

  // Apply a hit from player or AI
  hit(angleDeg, power) {
    const rad = (angleDeg * Math.PI) / 180;

    this.velocity.x = Math.cos(rad) * power;
    this.velocity.y = Math.sin(rad) * power * -1; // upward hit
  }

  // ------------------------------------------
  // Update loop
  // ------------------------------------------
  update() {
    // Apply gravity
    this.velocity.y += this.gravity;

    // Air drag
    this.velocity.x *= this.drag;
    this.velocity.y *= this.drag;

    // Limit fall speed
    if (this.velocity.y > this.maxFallSpeed) {
      this.velocity.y = this.maxFallSpeed;
    }

    // Move shuttle
    this.position.add(this.velocity);

    // Boundary collisions
    this.checkCourtBounds();

    // Net collision
    this.checkNetCollision();
  }

  // ------------------------------------------
  // Collision: Court Bounds
  // ------------------------------------------
  checkCourtBounds() {
    // Left + Right walls
    if (this.position.x < this.courtLeft) {
      this.position.x = this.courtLeft;
      this.velocity.x *= -0.4;
    }
    if (this.position.x > this.courtRight) {
      this.position.x = this.courtRight;
      this.velocity.x *= -0.4;
    }

    // Top boundary
    if (this.position.y < this.courtTop) {
      this.position.y = this.courtTop;
      this.velocity.y *= -0.4;
    }

    // Floor (landing)
    if (this.position.y > this.courtBottom) {
      this.position.y = this.courtBottom;
      this.velocity.y = 0;
      this.velocity.x = 0;

      this.landed = true; // external check in game engine
    } else {
      this.landed = false;
    }
  }

  // ------------------------------------------
  // Collision: Net
  // ------------------------------------------
  checkNetCollision() {
    const withinNetX = Math.abs(this.position.x - this.netX) < 12;

    if (withinNetX && this.position.y > this.courtTop && this.position.y < this.netHeight) {
      // Hit net → bounce back
      if (this.velocity.x > 0) this.velocity.x = -Math.abs(this.velocity.x) * 0.5;
      else this.velocity.x = Math.abs(this.velocity.x) * 0.5;

      // Small downward push to simulate hitting net tape
      this.velocity.y += 1.2;
    }
  }

  // ------------------------------------------
  // Predicted landing position (AI usage)
  // ------------------------------------------
  predictLanding() {
    let simPos = this.position.clone();
    let simVel = this.velocity.clone();

    let iterations = 0;
    while (simPos.y < this.courtBottom && iterations < 600) {
      simVel.y += this.gravity;
      simVel.x *= this.drag;
      simVel.y *= this.drag;

      simPos.add(simVel);
      iterations++;
    }

    return simPos.x;
  }
}
