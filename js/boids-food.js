var Food = function (context,  worldParams) {
  this.init(context, worldParams);
};

Food.prototype = {
  init: function (context, worldParams) {
    // save relevant info about the context
    this.context = context;
    this.width = this.context.canvas.width;
    this.height = this.context.canvas.height;
    this.boundsVec = new Vector(this.width, this.height);

    // save relevant world params
    this.foodSize = worldParams.foodSize;
    this.maxFoodBuildup = worldParams.maxFoodBuildup;
    this.foodBuildupRate = worldParams.foodBuildupRate;

    // clear the canvas before we start
    this.context.clearRect(0,0,this.width,this.height);

    // populate the whole grid with maximum food to begin with!
    this.grid = [];
    for (var i = 0; i < this.width*this.height; i++) {
      this.grid.push([this.maxFoodBuildup,0]);
    }
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
  }
};

