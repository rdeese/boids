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
var tangleP = document.getElementById("controls");

// buttons
var startStopButton = document.getElementById("startstopbutton");
var resetButton = document.getElementById("resetbutton");
var saveButton = document.getElementById("savebutton");
var loadButton = document.getElementById("loadbutton");

// draw single boid for illustration:
boidWithRangeContext.fillStyle = "rgba(128,0,0,0.3)";
boidWithRangeContext.beginPath();
boidWithRangeContext.arc(151,46,40,0,2*Math.PI);
boidWithRangeContext.fill();
boidWithRangeContext.fillStyle = "rgba(0,0,0,1)";
boidWithRangeContext.fillRect(150,45,3,3);


// hack to see if saving works
var savedWorld;

// prepare the charts
var frameRate = 150;
var secondsPerDatapoint = 2;
var numDataPoints = 100;

var charts;



//console.log("foodsize at top is:"+foodSize);

// for timing
var timeb;

var setup = function() {
  charts = new Charts(genomeChartContext, fitnessChartContext,
                      allGenomesChartContext, allFitnessesChartContext,
                      frameRate, secondsPerDatapoint, numDataPoints);
  charts.init();
  //console.log(f);
  timeb = performance.now();
  var c = new Controller(boidsCanvas, foodCanvas, tangleP);
};

var Controller = function (boidsCanvas, foodCanvas, tangleP) {
  this.init(boidsCanvas, foodCanvas, tangleP);
};

Controller.prototype = {
  init: function (boidsCanvas, foodCanvas, tangleP) {
    this.boidsContext = boidsCanvas.getContext("2d");
    this.foodContext = foodCanvas.getContext("2d");
    this.paramsUI = new Tangle(tangleP, {
      initialize: function () {
        // flock params
        this.boidSize = 3;
        this.maxSpeed = 3;
        this.minSpeed = 0;
        this.maxAcceleration = 0.3;
        this.neighborDistance = 40;
        this.populationSize = 120;
        this.mutationFactor = 0.2;
        this.lonelyDeathProbability = 0.08;

        // food params
        this.foodSize = 2;
        this.maxFoodBuildup = 100;
        this.foodBuildupRate = 100;
      },
      update: function () {
        this.collisionDistance = this.boidSize+1;
        if (this.minSpeed > this.maxSpeed) {
          this.minSpeed = this.maxSpeed - 1;
        }
      }
    });
    this.newWorld();
    startStopButton.onclick = this.startStopWorld.bind(this);
    resetButton.onclick = this.newWorld.bind(this);
    saveButton.onclick = this.saveWorld.bind(this);
    loadButton.onclick = this.loadWorld.bind(this);
  },

  startStopWorld: function () {
    if (this.worldIsRunning) {
      this.world.running = false;
      this.worldIsRunning = false;
    } else {
      this.world.running = true;
      this.worldIsRunning = true;
      this.world.run();
    }
  },

  newWorld: function () {
    if (this.worldIsRunning) {
      this.startStopWorld();
    }
    var worldParams = {
      boidSize: this.paramsUI.getValue("boidSize"),
      collisionDistance: this.paramsUI.getValue("collisionDistance"),
      minSpeed: this.paramsUI.getValue("minSpeed"),
      maxSpeed: this.paramsUI.getValue("maxSpeed"),
      maxAcceleration: this.paramsUI.getValue("maxAcceleration"),
      neighborDistance: this.paramsUI.getValue("neighborDistance"),
      collisionDistance: this.paramsUI.getValue("collisionDistance"),
      populationSize: this.paramsUI.getValue("populationSize"),
      mutationFactor: this.paramsUI.getValue("mutationFactor"),
      lonelyDeathProbability: this.paramsUI.getValue("lonelyDeathProbability"),
      foodSize: this.paramsUI.getValue("foodSize"),
      maxFoodBuildup: this.paramsUI.getValue("maxFoodBuildup"),
      foodBuildupRate: this.paramsUI.getValue("foodBuildupRate")
    };
    this.world = new World(this.boidsContext, this.foodContext, worldParams);
  },

  saveWorld: function () {
    savedWorld = this.worldToString(this.world);
  },

  loadWorld: function () {
    if (this.worldIsRunning) {
      this.startStopWorld();
    }
    this.world = this.worldFromString(savedWorld);
    this.paramsUI.setValues(this.world.worldParams);
  },

  worldToString: function (world) {
    var storage = {
      boidList: world.flock.boidList,
      worldParams: world.worldParams
    };

    for (var i = 0; i < storage.boidList.length; i++) {
      storage.boidList[i].nearestNeighbor = null;
    }

    console.log("storing:", storage);
    return JSON.stringify(storage);
  },

  worldFromString: function (datastring) {
    var data = JSON.parse(datastring);
    console.log("data from JSON:", data);
    return new World(this.boidsContext, this.foodContext, data);
  }
};

var World = function (boidsContext, foodContext, data) {
  if (data.hasOwnProperty("boidList")) {
    this.initSaved(boidsContext, foodContext, data);
  } else {
    this.initNew(boidsContext, foodContext, data);
  }
};

World.prototype = {
  initNew: function (boidsContext, foodContext, worldParams) {
    this.worldParams = worldParams;
    this.food = new Food(foodContext, worldParams);
    this.flock = new Flock(boidsContext, worldParams);
    this.timestep = 0;
    this.running = false;
  },

  initSaved: function (boidsContext, foodContext, data) {
    this.worldParams = data.worldParams;
    this.food = new Food(foodContext, data.worldParams);
    this.flock = new Flock(boidsContext, data.worldParams, data.boidList);
    this.timestep = 0;
    this.running = false;
  },

  run: function () {
    this.flock.step(this.food, this.timestep);
    this.food.recover();

    if (this.timestep % (secondsPerDatapoint*frameRate) === 0) {
      // calculate the averages
      for (var j = 0; j < this.flock.genomeAverages.length; j++) {
        this.flock.genomeAverages[j] /= this.flock.boidList.length;
      }

      // update the histogram
      var zip = function (boids) {
        return boids[0].genome.map(function(_,i){
          return boids.map(function(boid){return boid.genome[i];});
        });
      };

      var genes = zip(this.flock.boidList);
      var range = genes
        .map(function (x) {
          return d3.extent(x);
        })
        .reduce(function (x,y) {
          return [d3.min([x[0],y[0]]),d3.max([x[1],y[1]])];
        });
      var histLayout = d3.layout.histogram().range(range).bins(10).frequency(false);

      var histData = genes.map(function (data, i) {
        return {
          key: 'g_'+(i+1),
          values: histLayout(data)
        };
      });

      nv.addGraph(function() {
        var hist = nv.models.multiBarChart();

        hist.xAxis
          .tickFormat(d3.format(',.1f'));

        hist.yAxis
          .tickFormat(d3.format(',%'));

        hist.color(nv.utils.getColor(["rgba(128,0,0,0.5)",
                                      "rgba(255,0,0,0.5)",
                                      "rgba(0,128,0,0.5)",
                                      "rgba(0,0,255,0.5)",
                                      "rgba(0,255,255,0.5)"]));

        hist.animate = false;

        d3.select('#histogram svg')
          .datum(histData)
          .call(hist);

        return hist;
    });

      // Add them to the chart
      charts.genomeChart.addData([
        this.flock.genomeAverages[0],
        this.flock.genomeAverages[1],
        this.flock.genomeAverages[2],
        this.flock.genomeAverages[3],
        this.flock.genomeAverages[4],
      ], this.timestep);

      // Add the new average fitness to the chart
      charts.fitnessChart.addData([this.flock.fitnessTotal/this.flock.boidList.length], this.timestep);

      // Calculate and show framerate
      var timea = timeb;
      timeb = performance.now();
      elapsedTime = (timeb - timea)/1000;
      console.log(secondsPerDatapoint*frameRate/elapsedTime, " fps");

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

    // do the next timestep, or else save the data and start over
    if (this.running) {
      if (this.timestep <= frameRate*secondsPerDatapoint*numDataPoints) {
        setTimeout(this.run.bind(this), 1000/frameRate);
      } else {
        this.running = false;
      }
    }

    this.timestep++;
  },

};

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
    var startGenome = [0,0,0,0,0,0];
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
    var newGenome = [0,0,0,0,0,0];
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
    this.genomeAverages = [0,0,0,0,0,0];
    this.genomesLists = [[],[],[],[],[],[]];
    this.fitnessTotal = 0;

    // the possible reproducing boids
    var parentsList = [];

    // iterate over boids
    var boidsToBeKilled = {};
    var halfBoidSize = this.boidSize/2;
    for (var i = 0; i < this.boidList.length; i++) {
      var boid = this.boidList[i];
      var resultObj = this.updateBoid(boid, i, food.eat(boid.position, timestep));
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
    // and replace them
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
    if (Math.random() < this.lonelyDeathProbability && neighborCount == 0) { boidsCollidingWithThisBoid.push(thisBoidsIndex); }

    // apply new (incentivizes big groups) loneliness death possibility
    //if (Math.random()+Math.random()*neighborCount < this.lonelyDeathProbability) {
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
  },

  flockFinishedCallback: function () {
    charts.saveLocalToGlobal();
    charts.resetLocalCharts();
    food = new Food(foodCanvas, foodSize, maxFoodBuildup, foodBuildupRate);
    f = new Flock(boidsCanvas, food, worldParams);
    f.run();
  }
};

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

var Food = function (context,  worldParams) {
  this.init(context, worldParams);
};

Food.prototype = {
  init: function (context, worldParams) {
    this.context = context;
    this.width = this.context.canvas.width;
    this.height = this.context.canvas.height;
    this.boundsVec = new Vector(this.width, this.height);

    //console.log("foodsize is: "+foodSize);
    this.foodSize = worldParams.foodSize;
    this.maxFoodBuildup = worldParams.maxFoodBuildup;
    this.foodBuildupRate = worldParams.foodBuildupRate;

    this.context.clearRect(0,0,this.width,this.height);
    this.grid = [];
    for (var i = 0; i < this.width*this.height; i++) {
      this.grid.push([Math.floor(Math.random()*this.maxFoodBuildup),0]);
    }
    //console.log(this.grid.length);
  },

  eat: function (pos, timestep) {
    pos.wrap(this.boundsVec);
    var x = this.foodSize*Math.floor(pos.x/this.foodSize);
    var y = this.foodSize*Math.floor(pos.y/this.foodSize);
    var index = this.width*y+x;
    //console.log(this.foodSize);
    //console.log(index+"="+this.width+"*"+y+"+"+x);
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
  }
};

var Charts = function (genomeChartContext, fitnessChartContext,
                       allGenomesChartContext, allFitnessesChartContext,
                       frameRate, secondsPerDatapoint, numDataPoints) {
  // Set defaults for the Chart class
  Chart.defaults.global.animation = false;
  Chart.defaults.global.showTooltips = false;
  Chart.defaults.global.responsive = true;

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

var maxFoodBuildup;
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


window.onload = setup;
