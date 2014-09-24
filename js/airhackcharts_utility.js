var UTILS = (function(utils){

	"use strict";


	utils.getLevelFunctionForType = function(type){

		var levels = {
			O3: [0, 34, 67, 101, 121, 141, 161, 188, 214, 241],
			NO2: [0, 68, 135, 201, 268, 335, 401, 468, 535, 301],
			PM10: [0, 17, 34, 51, 59, 67, 76, 84, 92, 101]
		};

		if(!levels.hasOwnProperty(type) || levels[type] === undefined) return null;

		return function(data_point){
			return levels[type].filter( function(d){ return d<=data_point; } ).length;
		};
	};

	utils.getColourList = function(level){

		var colours = [
			"9CFF9C",
			"31FF00",
			"31CF00",
			"FFFF00",
			"FFCF00",
			"FF9A00",
			"FF6464",
			"FF0000",
			"990000",
			"CE30FF"
		];

		return colours.concat();
	};





	return utils;

})(UTILS || {});