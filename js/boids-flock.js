var Flock = function (context, worldParams, boidList) {
  this.init(context, worldParams);
  if (boidList) {
    this.boidList = [];
    for (var i = 0; i < boidList.length; i++) {
      var b = boidList[i];
      this.boidList.push(new Boid(b.genome,
                         b.position.x, b.position.y,
                         b.velocity.x, b.velocity.y,
                         b.acceleration.x, b.acceleration.y,
                         b.age));
    }
  } else {
    this.createStartingBoids();
  }
};

Flock.prototype = {
  init: function (context, worldParams) {
    this.context = context;
    this.width = this.context.canvas.width;
    this.height = this.context.canvas.height;
    this.boundsVec = new Vector(this.width, this.height);

    // copy over the flock params
    this.boidSize = worldParams.boidSize;
    this.collisionDistance = worldParams.collisionDistance;
    this.minSpeed = worldParams.minSpeed;
    this.maxSpeed = worldParams.maxSpeed;
    this.maxAcceleration = worldParams.maxAcceleration;
    this.neighborDistance = worldParams.neighborDistance;
    this.collisionDistance = worldParams.collisionDistance;
    this.populationSize = worldParams.populationSize;
    this.mutationFactor = worldParams.mutationFactor;
    this.lonelyDeathProbability = worldParams.lonelyDeathProbability;
  },

  createStartingBoids: function () {
    this.boidList = [];
    var xstep = this.width/Math.sqrt(this.populationSize);
    var ystep = this.height/Math.sqrt(this.populationSize);
    var xstart = 0;
    var ystart = 0;
    var startGenome = [0,0,0,0,0];
    var tempBoid;
    for (var i = 0; i < this.populationSize; i++) {
      tempBoid = new Boid(startGenome, xstart, ystart, 0, 0, 0, 0, 0);
      tempBoid.randomizeVelocity(this.minSpeed, this.maxSpeed);
      this.boidList.push(tempBoid);
      xstart += xstep;
      if (xstart > this.width) {
        xstart = 0;
        ystart += ystep;
      }
    }
  },

  evolveNewBoid: function (parentsList) {
    // decide on the parents
    var firstParent = this.boidList[Math.round(Math.random()*(this.boidList.length-1))];
    var secondParent = firstParent.nearestNeighbor ||
                       this.boidList[Math.round(Math.random()*(this.boidList.length-1))];

    while (firstParent.position.distanceFrom(secondParent.position) < 2*this.collisionDistance) {
      firstParent = this.boidList[Math.round(Math.random()*(this.boidList.length-1))];
      secondParent = firstParent.nearestNeighbor ||
                         this.boidList[Math.round(Math.random()*(this.boidList.length-1))];
    }

    // create the new genome
    var newGenome = [0,0,0,0,0];
    var crossoverPoint = Math.round(Math.random()*(newGenome.length-1));
    for (var i = 0; i < newGenome.length; i++) {
      if (i < crossoverPoint) {
        newGenome[i] = firstParent.genome[i]+this.mutationFactor*(Math.random()-0.5);
      } else {
        newGenome[i] = secondParent.genome[i]+this.mutationFactor*(Math.random()-0.5);
      }
    }

    /*
    // decide on a random position
    var xpos = Math.round(this.width*Math.random());
    var ypos = Math.round(this.height*Math.random());
    */

    // decide on a position between the parents
    var birthingRange = 20;
    var xpos = (firstParent.position.x + secondParent.position.x)/2 +
               birthingRange*Math.random() - birthingRange/2;
    var ypos = (firstParent.position.y + secondParent.position.y)/2 +
               birthingRange*Math.random() - birthingRange/2;
    // decide on a velocity between the parents
    var xvel = (firstParent.velocity.x + secondParent.velocity.x)/2;
    var yvel = (firstParent.velocity.y + secondParent.velocity.y)/2;

    return new Boid(newGenome, xpos, ypos, xvel, yvel, 0, 0, 0);
  },

  step: function (food, timestep) {
    // clear the canvas
    this.context.clearRect(0,0,this.width,this.height);

    // gather info about the boids
    this.genomeAverages = [0,0,0,0,0];
    this.fitnessTotal = 0;

    // the possible reproducing boids
    var parentsList = [];

    // iterate over boids
    var boidsToBeKilled = {};
    var halfBoidSize = this.boidSize/2;
    for (var i = 0; i < this.boidList.length; i++) {
      var boid = this.boidList[i];
      // update the boid internally
      var resultObj = this.updateBoid(boid, i, food.eat(boid.position, timestep));

      // collect boids that need to be killed
      var theseBoidsToBeKilled = resultObj.collidingBoids;
      if (theseBoidsToBeKilled.length > 0) {
        for (var j = 0; j < theseBoidsToBeKilled.length; j++) {
          boidsToBeKilled[theseBoidsToBeKilled[j]] = true;
        }
      } else {
        // if the boid isn't colliding with anyone, and it has
        // at least one neighbor, it's a potential parent.
        if (resultObj.neighborCount > 0) {
          parentsList.push(boid);
        }
      }

      // contribute to average genome
      for (var j = 0; j < this.genomeAverages.length; j++) {
        this.genomeAverages[j] += boid.genome[j];
      }
      // contribute to average age
      this.fitnessTotal += boid.age;
      // draw the updated boid
      this.context.fillRect(boid.position.x-halfBoidSize, boid.position.y-halfBoidSize, this.boidSize, this.boidSize);
    }

    // now kill the boids
    var boidsToBeKilledArray = [];
    for (var boidIndexString in boidsToBeKilled) {
      if (boidsToBeKilled.hasOwnProperty(boidIndexString)) {
        boidsToBeKilledArray.push(parseInt(boidIndexString));
      }
    }
    boidsToBeKilledArray.sort(function (x,y) { return x - y; });
    for (var i = boidsToBeKilledArray.length-1; i >= 0; i--) {
        this.boidList.splice(boidsToBeKilledArray[i], 1);
    }
    // and replace them with new boids
    for (var i = 0; i < boidsToBeKilledArray.length; i++) {
      this.boidList.push(this.evolveNewBoid(parentsList));
    }

  },

  updateBoid: function (boid, thisBoidsIndex, didEat) {
    var boidsCollidingWithThisBoid = [];
    var neighborCount = 0;
    boid.nearestNeighbor = null;
    boid.nearestNeighborDist = Infinity;
    var neighborContributedAcceleration = new Vector(0,0);

    // for all the boids that aren't this one, consider interaction.
    for (var i = 0; i < this.boidList.length; i++) {
      var otherBoid = this.boidList[i];
      var distanceFromOtherBoid = boid.position.distanceFrom(otherBoid.position);
      if (distanceFromOtherBoid < this.neighborDistance && boid != otherBoid) {
        // apply genomic flocking forces
        var accelerationFromThisNeighbor = boid.calculateAccelerationFromNeighbor(otherBoid);
        neighborContributedAcceleration.x += accelerationFromThisNeighbor.x;
        neighborContributedAcceleration.y += accelerationFromThisNeighbor.y;

        if (distanceFromOtherBoid < this.collisionDistance) {
          boidsCollidingWithThisBoid.push(i);
        } else if (distanceFromOtherBoid < boid.nearestNeighborDist) {
          boid.nearestNeighbor = otherBoid;
          boid.nearestNeighborDist = distanceFromOtherBoid;
        }

        neighborCount++;
      } else {
        otherBoid.position.unwrap(this.boundsVec, this.neighborDistance);
        distanceFromOtherBoid = boid.position.distanceFrom(otherBoid.position);
        if (distanceFromOtherBoid < this.neighborDistance && boid != otherBoid) {
          // apply genomic flocking forces
          var accelerationFromThisNeighbor = boid.calculateAccelerationFromNeighbor(otherBoid);
          neighborContributedAcceleration.x += accelerationFromThisNeighbor.x;
          neighborContributedAcceleration.y += accelerationFromThisNeighbor.y;

          if (distanceFromOtherBoid < this.collisionDistance) {
            boidsCollidingWithThisBoid.push(i);
          } else if (distanceFromOtherBoid < boid.nearestNeighborDist) {
            boid.nearestNeighbor = otherBoid;
            boid.nearestNeighborDist = distanceFromOtherBoid;
          }

         neighborCount++;
        }
        otherBoid.position.wrap(this.boundsVec);
      }
    }

    // apply loneliness death possibility
    if (Math.random() < this.lonelyDeathProbability && neighborCount === 0) { boidsCollidingWithThisBoid.push(thisBoidsIndex); }

    // apply new (incentivizes big groups) loneliness death possibility
    //if (Math.random()+Math.random()*neighborCount < this.lonelyDeathProbability) {
    //  boidsCollidingWithThisBoid.push(thisBoidsIndex);
    //}

    // if the boid didn't eat, it dies!
    if (!didEat) {
      boidsCollidingWithThisBoid.push(thisBoidsIndex);
    }

    if (neighborCount > 0) {
      boid.acceleration.x += neighborContributedAcceleration.x / neighborCount;
      boid.acceleration.y += neighborContributedAcceleration.y / neighborCount;
    }

    // apply genomic acceleration and velocity based changes
    boid.calculateAccelerationFromSelf();

    // do physics
    boid.iterateKinematics(this.boundsVec, this.minSpeed, this.maxSpeed, this.maxAcceleration);

    // get older
    boid.age++;

    // return indices to be deleted if this boid and another boid have collided.
    if (boidsCollidingWithThisBoid.length > 0) {
      boidsCollidingWithThisBoid.push(thisBoidsIndex);
    }
    return {
      collidingBoids: boidsCollidingWithThisBoid,
      neighborCount: neighborCount
    };
  }
};
