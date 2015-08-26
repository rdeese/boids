// Copyright Rupert Deese 2015
// Licensed under the GNU GPL http://www.gnu.org/licenses/gpl.txt
//

// DOM variables
var boidsCanvas = document.getElementById("boidsboidsboids");
var foodCanvas = document.getElementById("boidfood");
var boidWithRangeContext = document.getElementById("boidWithRange").getContext("2d");
var tangleP = document.getElementById("controls");

// buttons
var startStopButton = document.getElementById("startstopbutton");
var resetButton = document.getElementById("resetbutton");
var saveButton = document.getElementById("savebutton");
var loadButton = document.getElementById("loadbutton");
var saveFoodImgButton = document.getElementById("savefoodimg");

// draw single boid for illustration:
boidWithRangeContext.fillStyle = "rgba(128,0,0,0.3)";
boidWithRangeContext.beginPath();
boidWithRangeContext.arc(151,46,40,0,2*Math.PI);
boidWithRangeContext.fill();
boidWithRangeContext.fillStyle = "rgba(0,0,0,1)";
boidWithRangeContext.fillRect(150,45,3,3);


// hack to see if saving works
var savedWorld;
// FIXME putting graphingInterval here for now
var graphingInterval = 500;

// prepare the charts
var frameRate = 150;
var secondsPerDatapoint = 2;
var numDataPoints = 100;

var charts;



//console.log("foodsize at top is:"+foodSize);

// for timing
var timeb;

var setup = function() {
  charts = new Charts();
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
    var self = this;
    saveFoodImgButton.onclick = function () {
      var dataURL = self.foodContext.canvas.toDataURL("image/png");
      var w = window.open();
      w.document.write('<img src="'+dataURL+'"/>');
    };
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

    return JSON.stringify(storage);
  },

  worldFromString: function (datastring) {
    var data = JSON.parse(datastring);
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
    // iterate the flock and the food
    this.flock.step(this.food, this.timestep);
    this.food.recover();

    // collect our data
    if (this.timestep % graphingInterval === 0) {
      this.updateCharts();
    }

    // do the next timestep, or else save the data and start over
    if (this.running) {
      requestAnimationFrame(this.run.bind(this));
    }

    this.timestep++;
  },

  updateCharts: function () {
    charts.updateGeneHistogram(zipBoidListToGenes(this.flock.boidList));
    charts.updateFitnessHistogram(this.flock.boidList.map(function (b) { return b.age; }));

    /*
    // calculate the averages
    for (var j = 0; j < this.flock.genomeAverages.length; j++) {
      this.flock.genomeAverages[j] /= this.flock.boidList.length;
    }

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
    */

    // Calculate and show framerate
    // var timea = timeb;
    // timeb = performance.now();
    // elapsedTime = (timeb - timea)/1000;

    //console.log(Rate/elapsedTime, " fps");

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
};

var Charts = function () {
  this.initGeneHistogram();
  this.initFitnessHistogram();
};

Charts.prototype = {
  initGeneLineGraph: function () {
    d3.selectAll("#gene-linegraph svg > *").remove();
  },

  updateGeneLineGraph: function () {
  },

  initFitnessHistogram: function () {
    d3.selectAll("#fitnessHistogram svg > *").remove();
    this.fitnessHistogramLayout = d3.layout.histogram().bins(20).frequency(false);
    this.fitnessHistogram = nv.models.multiBarChart();
    this.fitnessHistogram.xAxis.tickFormat(d3.format(',f'));
    this.fitnessHistogram.yAxis.tickFormat(d3.format(',%'));
    this.fitnessHistogram.duration(0);
    this.fitnessHistogram.showControls(false);
    this.fitnessHistogram.color(nv.utils.getColor(["rgba(0,0,0,0.5)"]));
    this.fitnessHistogram.controls.updateState(true);
    this.fitnessHistogramState = this.fitnessHistogram.state;
    var self = this;
  },

  updateFitnessHistogram: function (fitnesses) {
    var self = this;
    var histData = [{
      key: 'Age Distribution',
      values: self.fitnessHistogramLayout(fitnesses)
    }];

    // push the update!
    var hist = this.fitnessHistogram;
    d3.select('#fitnessHistogram svg')
      .datum(histData)
      .call(hist);
  },

  initGeneHistogram: function () {
    d3.selectAll("#geneHistogram svg > *").remove();
    this.geneHistogramLayout = d3.layout.histogram().bins(20).frequency(false);
    this.geneHistogram = nv.models.multiBarChart();
    this.geneHistogram.xAxis.tickFormat(d3.format(',.1f'));
    this.geneHistogram.yAxis.tickFormat(d3.format(',%'));
    this.geneHistogram.duration(0);
    this.geneHistogram.color(nv.utils.getColor(["rgba(128,0,0,0.5)",
                                            "rgba(255,0,0,0.5)",
                                            "rgba(0,128,0,0.5)",
                                            "rgba(0,0,255,0.5)",
                                            "rgba(0,255,255,0.5)"]));
    this.geneHistogram.controls.updateState(true);
    this.geneHistogramState = this.geneHistogram.state;
    var self = this;
  },

  updateGeneHistogram: function (genes) {
    // get the range of the data
    var range = genes
      .map(function (x) {
        return d3.extent(x);
      })
      .reduce(function (x,y) {
        return [d3.min([x[0],y[0]]),d3.max([x[1],y[1]])];
      });

    var self = this;
    var histData = genes.map(function (data, i) {
      return {
        key: 'g_'+(i+1),
        disabled: self.geneHistogramState.disabled !== undefined ? self.geneHistogramState.disabled[i] : false,
        values: self.geneHistogramLayout.range(range)(data)
      };
    });

    // push the update!
    var hist = this.geneHistogram;
    d3.select('#geneHistogram svg')
      .datum(histData)
      .call(hist);
  }
};


window.onload = setup;
