var Boid = function (genome,x,y,xv,yv,xa,ya,age) {
  this.genome = genome;
  this.position = new Vector (x,y);
  this.velocity = new Vector (xv, yv);
  this.acceleration = new Vector(xa,ya);
  this.age = age;
};

Boid.prototype = {
  randomizePosition: function (width, height) {
    this.position = new Vector(Math.random()*width, Math.random()*height);
  },

  randomizeVelocity: function (minSpeed, maxSpeed) {
    this.velocity = new Vector (minSpeed + Math.random()*(maxSpeed-minSpeed), minSpeed + Math.random()*(maxSpeed-minSpeed));
  },

  normalizeAcceleration: function (maxAcceleration) {
    this.acceleration.normalize(0, maxAcceleration);
  },

  normalizeVelocity: function (minSpeed, maxSpeed) {
    this.velocity.normalize(minSpeed, maxSpeed);
  },

  calculateAccelerationFromNeighbor: function (otherBoid) {
    var neighborContributedAcceleration = new Vector(0,0);
    neighborContributedAcceleration.x += this.genome[4]*(otherBoid.position.x - this.position.x);
    neighborContributedAcceleration.y += this.genome[4]*(otherBoid.position.y - this.position.y);
    neighborContributedAcceleration.x += this.genome[3]*(otherBoid.velocity.x - this.velocity.x);
    neighborContributedAcceleration.y += this.genome[3]*(otherBoid.velocity.y - this.velocity.y);
    neighborContributedAcceleration.x += this.genome[2]*(otherBoid.acceleration.x - this.acceleration.x);
    neighborContributedAcceleration.y += this.genome[2]*(otherBoid.acceleration.y - this.acceleration.y);
    return neighborContributedAcceleration;
  },

  calculateAccelerationFromSelf: function () {
    this.acceleration.x += this.acceleration.x*this.genome[0];
    this.acceleration.y += this.acceleration.y*this.genome[0];
    this.acceleration.x += this.velocity.x*this.genome[1];
    this.acceleration.y += this.velocity.y*this.genome[1];
  },

  iterateKinematics: function(boundsVec, minSpeed, maxSpeed, maxAcceleration) {
    //console.log(boundsVec, minSpeed, maxSpeed, maxAcceleration);
    this.normalizeAcceleration(maxAcceleration);
    this.velocity.x += this.acceleration.x;
    this.velocity.y += this.acceleration.y;
    this.normalizeVelocity(minSpeed, maxSpeed);
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
    this.position.wrap(boundsVec);
  },

};
