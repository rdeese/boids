// Copyright Rupert Deese 2015
// Licensed under the GNU GPL http://www.gnu.org/licenses/gpl.txt
//

// DOM variables
var boidsCanvas = document.getElementById("boidsboidsboids");
var foodCanvas = document.getElementById("boidfood");
var genomeChartContext = document.getElementById("genomeChart").getContext("2d");
var fitnessChartContext = document.getElementById("fitnessChart").getContext("2d");
var allGenomesChartContext = document.getElementById("allGenomesChart").getContext("2d");
var allFitnessesChartContext = document.getElementById("allFitnessesChart").getContext("2d");
var boidWithRangeContext = document.getElementById("boidWithRange").getContext("2d");

// draw single boid for illustration:
boidWithRangeContext.fillStyle = "rgba(128,0,0,0.3)";
boidWithRangeContext.beginPath();
boidWithRangeContext.arc(151,46,40,0,2*Math.PI);
boidWithRangeContext.fill();
boidWithRangeContext.fillStyle = "rgba(0,0,0,1)";
boidWithRangeContext.fillRect(150,45,3,3);

// prepare the charts
var frameRate = 200;
var secondsPerDatapoint = 2;
var numDataPoints = 10;
var boidsContext = boidsCanvas.getContext("2d");
var canvasWidth = boidsCanvas.width;
var canvasHeight = boidsCanvas.height;
var genomeChart;
var fitnessChart;
var allGenomesChart;
Chart.defaults.global.animation = false;
Chart.defaults.global.showTooltips = false;

var Charts = function (genomeChartContext, fitnessChartContext,
                       allGenomesChartContext, allFitnessesChartContext,
                       frameRate, secondsPerDatapoint, numDataPoints) {
  this.genomeChartContext = genomeChartContext;
  this.fitnessChartContext = fitnessChartContext;
  this.allGenomesChartContext = allGenomesChartContext;
  this.allFitnessesChartContext = allFitnessesChartContext;

  this.dummyLabels = [];
  this.dummyData = [];
  for (var i = 0; i <= numDataPoints; i++) {
    this.dummyLabels.push(secondsPerDatapoint*frameRate*i);
    this.dummyData.push(0);
  }
  this.init();
};

Charts.prototype = {
  init: function () {
    this.resetLocalCharts();
    this.resetGlobalCharts();
  },

  resetLocalCharts: function () {
    this.genomeChart = new Chart(this.genomeChartContext).Line({
      labels: [0],
      datasets: [
        {
          strokeColor: "rgba(128,0,0,0.5)",
          data: [0]
        },
        {
          strokeColor: "rgba(255,0,0,0.5)",
          data: [0]
        },
        {
          strokeColor: "rgba(0,128,0,0.5)",
          data: [0]
        },
        {
          strokeColor: "rgba(0,0,255,0.5)",
          data: [0]
        },
        {
          strokeColor: "rgba(0,255,255,0.5)",
          data: [0]
        },
      ]
    },
    {
      bezierCurve: false,
      datasetFill: false,
      pointDot: false,
    });

    this.fitnessChart = new Chart(this.fitnessChartContext).Line({
      labels: [0],
      datasets: [
        {
          strokeColor: "rgba(0,0,0,0.5)",
          data: [0]
        }
      ]
    },
    {
      bezierCurve: false,
      datasetFill: false,
      pointDot: false,
    });
  },

  resetGlobalCharts: function () {
    this.allGenomesChart = new Chart(allGenomesChartContext).Line({
      labels: this.dummyLabels,
      datasets: [
        {
          strokeColor: "rgba(0,0,0,0)",
          data: this.dummyData
        }
      ]
    },
    {
      bezierCurve: false,
      datasetFill: false,
      pointDot: false,
    });

    this.allFitnessesChart = new Chart(allFitnessesChartContext).Line({
      labels: this.dummyLabels,
      datasets: [
        {
          strokeColor: "rgba(0,0,0,0)",
          data: this.dummyData
        }
      ]
    },
    {
      bezierCurve: false,
      datasetFill: false,
      pointDot: false,
    });
  },

  saveLocalToGlobal: function () {
    this.allGenomesChart.datasets = this.allGenomesChart.datasets.concat(this.genomeChart.datasets);
    this.allFitnessesChart.datasets = this.allFitnessesChart.datasets.concat(this.fitnessChart.datasets);
    this.allGenomesChart.update();
    this.allFitnessesChart.update();
  }
};

var f;
var charts;

// everything is arbitrary!
var boidSize = 3;
var maxSpeed = 3;
var minSpeed = 0;
var maxAcceleration = 0.3;
var neighborDistance = 40;
var collisionDistance = 4;
var startingNumberOfBoids = 120;
var mutationFactor = 0.2;
var lonelyDeathProbability = 0.08;

// for timing
var timeb;

var setup = function() {
  charts = new Charts(genomeChartContext, fitnessChartContext,
                      allGenomesChartContext, allFitnessesChartContext,
                      frameRate, secondsPerDatapoint, numDataPoints);
  charts.init();
  food = new Food(foodCanvas);
  f = new Flock(boidsCanvas, food);
  timeb = performance.now();
  f.run();
};

var Flock = function (canvas, food) {
  this.init(canvas, food);
};

Flock.prototype = {
  init: function (canvas, food) {
    this.canvas = canvas;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.boundsVec = new Vector(this.width, this.height);
    this.context = this.canvas.getContext("2d");
    this.boidList = [];
    this.food = food;
    this.timestep = 0;
    this.createStartingBoids();
  },

  createStartingBoids: function () {
    var xstep = this.width/Math.sqrt(startingNumberOfBoids);
    var ystep = this.height/Math.sqrt(startingNumberOfBoids);
    var xstart = 0;
    var ystart = 0;
    var startGenome = [0,0,0,0,0,0];
    for (var i = 0; i < startingNumberOfBoids; i++) {
      this.boidList.push(new Boid(startGenome, xstart, ystart));
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

    // create the new genome
    var newGenome = [0,0,0,0,0,0];
    var crossoverPoint = Math.round(Math.random()*(newGenome.length-1));
    for (var i = 0; i < newGenome.length; i++) {
      if (i < crossoverPoint) {
        newGenome[i] = firstParent.genome[i]+mutationFactor*(Math.random()-0.5);
      } else {
        newGenome[i] = secondParent.genome[i]+mutationFactor*(Math.random()-0.5);
      }
    }

    /*
    // decide on a random position
    var xpos = Math.round(this.width*Math.random());
    var ypos = Math.round(this.height*Math.random());
    */

    // decide on a position between the parents
    var birthingRange = 20;
    var xpos = (firstParent.position.x + secondParent.position.x)/2
               + birthingRange*Math.random() - birthingRange/2;
    var ypos = (firstParent.position.y + secondParent.position.y)/2
               + birthingRange*Math.random() - birthingRange/2;
    // decide on a velocity between the parents
    var xvel = (firstParent.velocity.x + secondParent.velocity.x)/2;
    var yvel = (firstParent.velocity.y + secondParent.velocity.y)/2;

    return new Boid(newGenome, xpos, ypos, xvel, yvel);
  },
  run: function (callback) {
    // clear the canvas
    this.context.clearRect(0,0,this.width,this.height);

    // gather info about the boids
    var genomeAverages = [0,0,0,0,0,0];
    var fitnessTotal = 0;

    // the possible reproducing boids
    var parentsList = [];

    // iterate over boids
    var boidsToBeKilled = {};
    for (var i = 0; i < this.boidList.length; i++) {
      var boid = this.boidList[i];
      var resultObj = this.updateBoid(boid, i, this.food.eat(boid.position, this.timestep));
      var theseBoidsToBeKilled = resultObj.collidingBoids;
      if (theseBoidsToBeKilled.length > 0) {
        for (var j = 0; j < theseBoidsToBeKilled.length; j++) {
          boidsToBeKilled[theseBoidsToBeKilled[j]] = true;
        }
      } else {
        if (resultObj.neighborCount > 0) {
          parentsList.push(boid);
        }
      }

      // contribute to average genome
      for (var j = 0; j < genomeAverages.length; j++) {
        genomeAverages[j] += boid.genome[j];
      }
      // contribute to average age
      fitnessTotal += boid.age;
      // draw the updated boid
      this.context.fillRect(boid.position.x, boid.position.y, boidSize, boidSize);
    }

    this.food.recover();

    if (this.timestep % (secondsPerDatapoint*frameRate) === 0) {
      // calculate the averages
      for (var j = 0; j < genomeAverages.length; j++) {
        genomeAverages[j] /= this.boidList.length;
      }

      /*if (this.timestep % (20*frameRate) == 0) {
        for (var i = 0; i < chart.datasets.length; i++) {
          for (var j = 1; j < 20; j++) {

          }
        }
        chart.update();
      }*/

      charts.genomeChart.addData([
        genomeAverages[0],
        genomeAverages[1],
        genomeAverages[2],
        genomeAverages[3],
        genomeAverages[4],
      ], this.timestep);

      var timea = timeb;
      timeb = performance.now();
      elapsedTime = (timeb - timea)/1000;
      console.log(secondsPerDatapoint*frameRate/elapsedTime, " fps");


      charts.fitnessChart.addData([fitnessTotal/this.boidList.length], this.timestep);

      // calculate the standard deviations
      /*var genomeDeviations = [0,0,0,0,0,0];
      for (var i = 0; i < this.boidList.length; i++) {
        for (var j = 0; j < genomeAverages.length; j++) {
          var difference = this.boidList[i].genome[j] - genomeAverages[j];
          genomeDeviations[j] += difference*difference;
        }
      }

      for (var j = 0; j < genomeAverages.length; j++) {
        genomeDeviations[j] = Math.sqrt(genomeDeviations[j]/this.boidList.length);
      }*/
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
    // and replace them
    for (var i = 0; i < boidsToBeKilledArray.length; i++) {
      this.boidList.push(this.evolveNewBoid(parentsList));
    }

    this.timestep++;

    // do the next timestep, or else save the data and start over
    if (this.timestep <= frameRate*secondsPerDatapoint*numDataPoints) {
      setTimeout(this.run.bind(this), 1000/frameRate);
    } else {
      this.flockFinishedCallback();
    }
  },

  updateBoid: function (boid, thisBoidsIndex, didEat) {
    var boidsCollidingWithThisBoid = [];
    var neighborCount = 0;
    boid.nearestNeighbor = null;
    boid.nearestNeighborDist = Infinity;
    var neighborContributedAcceleration = new Vector(0,0);

    for (var i = 0; i < this.boidList.length; i++) {
      var otherBoid = this.boidList[i];
      var distanceFromOtherBoid = boid.position.distanceFrom(otherBoid.position);
      if (distanceFromOtherBoid < neighborDistance && boid != otherBoid) {
        // apply genomic flocking forces
        var accelerationFromThisNeighbor = boid.calculateAccelerationFromNeighbor(otherBoid);
        neighborContributedAcceleration.x += accelerationFromThisNeighbor.x;
        neighborContributedAcceleration.y += accelerationFromThisNeighbor.y;

        if (distanceFromOtherBoid < collisionDistance) {
          boidsCollidingWithThisBoid.push(i);
        } else if (distanceFromOtherBoid < boid.nearestNeighborDist) {
          boid.nearestNeighbor = otherBoid;
          boid.nearestNeighborDist = distanceFromOtherBoid;
        }

        neighborCount++;
      } else {
        otherBoid.position.unwrap(this.boundsVec, neighborDistance);
        distanceFromOtherBoid = boid.position.distanceFrom(otherBoid.position);
        if (distanceFromOtherBoid < neighborDistance && boid != otherBoid) {
          // apply genomic flocking forces
          var accelerationFromThisNeighbor = boid.calculateAccelerationFromNeighbor(otherBoid);
          neighborContributedAcceleration.x += accelerationFromThisNeighbor.x;
          neighborContributedAcceleration.y += accelerationFromThisNeighbor.y;

          if (distanceFromOtherBoid < collisionDistance) {
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
    // if (Math.random() < lonelyDeathProbability && neighborCount == 0) { boidsCollidingWithThisBoid.push(thisBoidsIndex); }

    // apply new (incentivizes big groups) loneliness death possibility
    //if (Math.random()+Math.random()*neighborCount < lonelyDeathProbability) {
    //  boidsCollidingWithThisBoid.push(thisBoidsIndex);
    //}

    // try to eat, die if ye fail.
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
    boid.iterateKinematics(this.boundsVec);

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
  },

  flockFinishedCallback: function () {
    charts.saveLocalToGlobal();
    charts.resetLocalCharts();
    food = new Food(foodCanvas);
    f = new Flock(boidsCanvas, food);
    f.run();
  }
};

var Boid = function (genome,x,y,xv,yv) {
  this.genome = genome;
  this.position = new Vector (x,y);
  if (xv && yv) {
    this.velocity = new Vector (xv, yv);
  } else {
    this.randomStartVelocity();
  }
  this.acceleration = new Vector(0,0);
  this.age = 0;
};

Boid.prototype = {
  randomStartPosition: function (width, height) {
    this.position = new Vector(Math.random()*width, Math.random()*height);
  },

  randomStartVelocity: function () {
    this.velocity = new Vector (Math.random(), Math.random());
    this.normalizeVelocity();
  },

  normalizeAcceleration: function () {
    this.acceleration.normalize(0, maxAcceleration);
  },

  normalizeVelocity: function () {
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

  iterateKinematics: function(boundsVec) {
    this.normalizeAcceleration();
    this.velocity.x += this.acceleration.x;
    this.velocity.y += this.acceleration.y;
    this.normalizeVelocity();
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
    this.position.wrap(boundsVec);
  },

};

var Vector = function (x, y) {
	this.x = x;
	this.y = y;
};

Vector.prototype = {
	magnitude: function () {
		return Math.sqrt(this.x*this.x + this.y*this.y);
	},

	wrap: function (bounds) {
		if (this.x < 0) { this.x = bounds.x + this.x; }
		if (this.x >= bounds.x) { this.x = this.x - bounds.x; }
		if (this.y < 0) { this.y = bounds.y + this.y; }
		if (this.y >= bounds.y) { this.y = this.y - bounds.y; }
	},

	unwrap: function (bounds, limit) {
		if (this.x < limit) { this.x = bounds.x + this.x; }
		if (this.x >= bounds.x-limit) { this.x = this.x - bounds.x; }
		if (this.y < limit) { this.y = bounds.y + this.y; }
		if (this.y >= bounds.y-limit) { this.y = this.y - bounds.y; }
	},

  distanceFrom: function (point) {
    var xDiff = this.x - point.x;
    var yDiff = this.y - point.y;
    return Math.sqrt(xDiff*xDiff + yDiff*yDiff);
  },

  normalize: function (min, max) {
    var magnitude = this.magnitude();
    if (magnitude < min) {
      this.x = this.x*(min/magnitude);
      this.y = this.y*(min/magnitude);
    } else if (magnitude > max) {
      this.x = this.x*(max/magnitude);
      this.y = this.y*(max/magnitude);
    }
  }
};

var Food = function (canvas) {
  this.init(canvas);
};

Food.prototype = {
  init: function (canvas) {
    this.canvas = canvas;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.boundsVec = new Vector(this.width, this.height);
    this.context = this.canvas.getContext("2d");
    this.grid = [];
    for (var i = 0; i < this.width*this.height; i++) {
      this.grid.push([Math.floor(Math.random()*this.maxFoodBuildup),0]);
    }
    console.log(this.grid.length);
  },

  eat: function (pos, timestep) {
    pos.wrap(this.boundsVec);
    var x = this.foodSize*Math.floor(pos.x/this.foodSize);
    var y = this.foodSize*Math.floor(pos.y/this.foodSize);
    var index = this.width*y+x;
    var health = this.grid[index][0];
    var lastVisit = this.grid[index][1];
    if (timestep >= lastVisit+this.foodBuildupRate && health < this.maxFoodBuildup) {
      health += 1;
    }
    this.grid[index][1] = timestep;
    if (health > 0) {
      this.grid[index][0] = health-1;
      this.context.fillStyle = "rgba(0,128,128,0.1)";
      this.context.fillRect(x,y,this.foodSize,this.foodSize);
      return true;
    } else {
      return false;
    }
  },

  recover: function () {
    this.context.fillStyle = "rgba(255,255,255,0.01)";
    this.context.fillRect(0,0,this.width,this.height);
  },

  foodSize: 2,

  maxFoodBuildup: 100,

  foodBuildupRate: 100
};



setup();
