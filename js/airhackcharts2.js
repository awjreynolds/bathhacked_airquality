var AIRHACKCHARTS = function ($,crossfilter,d3,dc,ahc,utils){
	"use strict";
 
    var dateFormat = d3.time.format("%Y/%m/%d %H:%M:%S %p");
    var USdateFormat = d3.time.format("%m/%d/%Y %H:%M:%S %p");
	ahc.crossStore = ahc.crossStore || {};
	ahc.dimensions = ahc.dimensions || {};
	ahc.downloadedData = ahc.downloadedData || {};
	ahc.constants = ahc.constants || {};
	var calcNO2level = utils.getLevelFunctionForType("NO2");
	var calcO3level = utils.getLevelFunctionForType("O3");
	var calcPM10level = utils.getLevelFunctionForType("PM10");

	var loadstatus = {history : false, weather : false};

	var levelRange = [1,2,3,4,5,6,7,8,9,10];
	var hourRange = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24];
	var levelColorScale = d3.scale.ordinal().domain(levelRange)
		.range([
	"#9CFF9C",
	"#31FF00",
	"#31CF00",
	"#FFFF00",
	"#FFCF00",
	"#FF9A00",
	"#FF6464",
	"#FF0000",
	"#990000",
	"#CE30FF"]);
	Date.prototype.getDOY = function() {
		var onejan = new Date(this.getFullYear(),0,1);
		return Math.ceil((this - onejan) / 86400000) === 0? 1:Math.ceil((this - onejan) / 86400000);
		}
	function downloadData (){
		d3.csv("/Historical_Air_Quality_Sensor_Data.csv", function(data){
			
			data.forEach ( function (d){
				d.dd = dateFormat.parse(d.DateTime);
				d.NO2 = d.NO2 === ""? NaN: Number(d.NO2);
				d.NO2_level = calcNO2level(d.NO2);
				d.O3 = d.O3 === ""? NaN: Number(d.O3);
				d.O3_level = calcO3level(d.O3);
				d.PM10 = d.PM10 === ""? NaN: Number(d.PM10);
				d.PM10_level = calcPM10level(d.PM10);
				d.location = d["Sensor Location Name"];
				d.month = d3.time.month(d.dd);
				d.year = d3.time.year(d.dd);
				d.day = d3.time.day(d.dd);
				d.hour = d3.time.hour(d.dd);
				d.doy = d.dd.getDOY();

			});
			ahc.downloadedData.historydata = data.filter(function (d){
				return d.dd.getFullYear() >= 2010;});
			loadstatus.history = true;
			if (loadstatus.history && loadstatus.weather){
				stichDataTogether();
			}
		});
		d3.csv("/weather.csv", function(wdata){

			wdata.forEach(function (d){
				d.dd = USdateFormat.parse(d.time);

				d.hour = d3.time.hour(d.dd);
				d.temp = Math.round((Number(d.tempi)-32)*5/9);
				d.wind = Math.round(Number(d.wspdi));
				d.rain = Math.round(Number(d.precip_totali));
			});

			ahc.downloadedData.weatherdata = wdata;
			// Create a weather crossfilter
			ahc.crossStore.weather = crossfilter(ahc.downloadedData.weatherdata);
			ahc.dimensions.weatherByHour = ahc.crossStore.weather.dimension(function (d){return d.hour});
			// group by hour
			var weatherGroup = ahc.dimensions.weatherByHour.group().reduce(
				function (p,v){
					p.count ++;
					p.total_rain += v.rain;
					p.total_temp += v.temp;
					p.avg_temp = Math.round(p.total_temp / p.count);
					p.total_wind += v.wind;
					p.avg_wind = Math.round(p.total_wind / p.count);
					return p;
				},
				function (p,v){
					return p;
				},
				function (){
					return {
						total_rain: 0,
						total_temp: 0, avg_temp:0,
						total_wind: 0, avg_wind:0,
						count: 0
					}
				}


			);

			ahc.downloadedData.weatherMatrix = {};

			weatherGroup.all().forEach (function (d){
				ahc.downloadedData.weatherMatrix[d.key]= d.value;
			});
			loadstatus.weather = true;
			if (loadstatus.history && loadstatus.weather){
				stichDataTogether();
			}
		});
	}

	function stichDataTogether () {
		// Bring the 
		ahc.downloadedData.historydata.forEach(function (d){
			if(ahc.downloadedData.weatherMatrix[d.day]){
				d.temp = ahc.downloadedData.weatherMatrix[d.day].avg_temp;
				d.rain = Math.round(ahc.downloadedData.weatherMatrix[d.day].total_rain);
				d.wind = ahc.downloadedData.weatherMatrix[d.day].avg_wind;
			} else {
				d.temp = NaN;
				d.rain = NaN;
				d.wind = NaN;
			}
			
		});
 		renderCharts();

	};


	function renderCharts(){
		ahc.crossStore.hist = crossfilter(ahc.downloadedData.historydata);
		ahc.dimensions.dayDimension = ahc.crossStore.hist.dimension(function(d) {return d.day});
		var readingsPerDayGroup = ahc.dimensions.dayDimension.group();
		var readingsChart = dc.barChart("#chart1");
		console.log ("rendering");
		readingsChart.width(1400)
				.height(200)
				.dimension(ahc.dimensions.dayDimension)
				.group(readingsPerDayGroup, "Probes per day")
				.centerBar(true)
				.x(d3.time.scale().domain([ahc.downloadedData.historydata[0].dd, ahc.downloadedData.historydata[ahc.downloadedData.historydata.length-1].dd]))
				.round(d3.time.day.round)
				.xUnits(d3.time.days)
				.title(function(d){return d.value + ' readings'})
				.elasticY(true)
				.xAxisLabel("Readings Per Day");

		
		$("#resetData").show();
		ahc.dimensions.dayOfWeek = ahc.crossStore.hist.dimension(function (d) {
	        var day = d.dd.getDay();
	        var name=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
	        return day+"."+name[day];
	     });
		var dayOfWeekGroup = ahc.dimensions.dayOfWeek.group();

		var dayOfWeekChart = dc.pieChart("#chart2");
		dayOfWeekChart
	        .width(300) 
	        .height(300)
	        .radius(150)
			.dimension(ahc.dimensions.dayOfWeek)
			.group(dayOfWeekGroup)
        	.label();
		// Hour breakdown


        ahc.dimensions.hours = ahc.crossStore.hist.dimension(function (d){return d.dd.getHours();});
        var hoursgroup = ahc.dimensions.hours.group();

        var hoursChart = dc.barChart("#chart3");
		hoursChart
			.width(300)
			.height(300)
			.dimension(ahc.dimensions.hours)
			.group(hoursgroup)
			.brushOn(false)
			.xUnits(dc.units.ordinal)
			.centerBar(false)
       		.elasticY(true)
			.x(d3.scale.ordinal().domain(hourRange))
			.xAxisLabel("Hour of Reading");


        ahc.dimensions.location = ahc.crossStore.hist.dimension(function (d){ return d.location})
        var locationGroup = ahc.dimensions.location.group();

      	var locationChart = dc.rowChart("#chart4");
		locationChart
			.width(300)
			.height(300)
			.dimension(ahc.dimensions.location)
			.group(locationGroup)
			.elasticX(true)
			.ordering(function(d){return -d.value})
			.othersGrouper(false);		

		// Display NO2 levels.

        ahc.dimensions.no2levels = ahc.crossStore.hist.dimension(function (d){ return d.NO2_level});

        var no2levelsRAWgroup = ahc.dimensions.no2levels.group();

        var no2levelsgroup = {
			all:function () {
				var g = [];
				no2levelsRAWgroup.all().forEach(function(d,i){
					if (d.key !== 0) {g.push(d);}
				});
				return g;
			},
			top:function (k) {
				var g = [];
				no2levelsRAWgroup.top(k).forEach(function(d,i){
					if (d.key !== 0) {g.push(d);}
				});
				return g;
			}
		};

		var no2levelsChart = dc.barChart("#chart5");
		no2levelsChart
			.width(300)
			.height(300)
			.dimension(ahc.dimensions.no2levels)
			.group(no2levelsgroup)
			.brushOn(false)
			.xUnits(dc.units.ordinal)
			.centerBar(false)
       		.elasticY(true)
			.x(d3.scale.ordinal().domain(levelRange))
			.xAxisLabel("NO2 Levels Occurances");		

		// Display O3 levels.

        ahc.dimensions.O3levels = ahc.crossStore.hist.dimension(function (d){ return d.O3_level});

        var O3levelsRAWgroup = ahc.dimensions.O3levels.group();

        var O3levelsgroup = {
			all:function () {
				var g = [];
				O3levelsRAWgroup.all().forEach(function(d,i){
					if (d.key !== 0) {g.push(d);}
				});
				return g;
			},
			top:function (k) {
				var g = [];
				O3levelsRAWgroup.top(k).forEach(function(d,i){
					if (d.key !== 0) {g.push(d);}
				});
				return g;
			}
		};

		var O3levelsChart = dc.barChart("#chart6");
		O3levelsChart
			.width(300)
			.height(300)
			.dimension(ahc.dimensions.O3levels)
			.group(O3levelsgroup)
			.brushOn(false)
			.xUnits(dc.units.ordinal)
			.centerBar(false)
       		.elasticY(true)
			.x(d3.scale.ordinal().domain(levelRange))
			.xAxisLabel("O3 Level Occurances");		


		// Display PM10 levels.

        ahc.dimensions.PM10levels = ahc.crossStore.hist.dimension(function (d){ return d.PM10_level});

        var PM10levelsRAWgroup = ahc.dimensions.PM10levels.group();

        var PM10levelsgroup = {
			all:function () {
				var g = [];
				PM10levelsRAWgroup.all().forEach(function(d,i){
					if (d.key !== 0) {g.push(d);}
				});
				return g;
			},
			top:function (k) {
				var g = [];
				PM10levelsRAWgroup.top(k).forEach(function(d,i){
					if (d.key !== 0) {g.push(d);}
				});
				return g;
			}
		};

		var PM10levelsChart = dc.barChart("#chart7");
		PM10levelsChart
			.width(300)
			.height(300)
			.dimension(ahc.dimensions.PM10levels)
			.group(PM10levelsgroup)
			.brushOn(false)
			.xUnits(dc.units.ordinal)
			.centerBar(false)
       		.elasticY(true)
			.x(d3.scale.ordinal().domain(levelRange))
			.xAxisLabel("PM10 Level Occurances");



        ahc.dimensions.temps = ahc.crossStore.hist.dimension(function (d){ return d.temp});
        var tempRAWGroup = ahc.dimensions.temps.group();

		// create range.
		var minTemp = 100;
		var maxTemp = 0;
		var tempRange = []
        var tempgroup = {
			all:function () {
				var g = [];
				tempRAWGroup.all().forEach(function(d,i){
					if (d.key !== NaN) {g.push(d);}
					minTemp = minTemp > d.temp? d.temp: minTemp;
					maxTemp = maxTemp < d.temp? d.temp: maxTemp;
				});
				return g;
			},
			top:function (k) {
				var g = [];
				tempRAWGroup.top(k).forEach(function(d,i){
					if (d.key !== NaN) {g.push(d);}
				});
				return g;
			}
		};

		tempgroup.all();
		for (var i = minTemp; i <= maxTemp; i++) {
			tempRange.push(i);
		};

		var tempChart = dc.barChart("#chart8");
		tempChart
			.width(300)
			.height(300)
			.dimension(ahc.dimensions.temps)
			.group(tempgroup)
			.brushOn(false)
			.xUnits(dc.units.ordinal)
			.centerBar(false)
       		.elasticY(true)
			.x(d3.scale.ordinal().domain(tempRange))
			.xAxisLabel("Temperature");

        ahc.dimensions.winds = ahc.crossStore.hist.dimension(function (d){ return d.wind});
        var windRAWGroup = ahc.dimensions.winds.group();

		// create range.
		var minwind = 100;
		var maxwind = 0;
		var windRange = []
        var windgroup = {
			all:function () {
				var g = [];
				windRAWGroup.all().forEach(function(d,i){
					if (d.key !== NaN) {g.push(d);}
					minwind = minwind > d.wind? d.wind: minwind;
					maxwind = maxwind < d.wind? d.wind: maxwind;
				});
				return g;
			},
			top:function (k) {
				var g = [];
				windRAWGroup.top(k).forEach(function(d,i){
					if (d.key !== NaN) {g.push(d);}
				});
				return g;
			}
		};

		windgroup.all();
		for (var i = minwind; i <= maxwind; i++) {
			windRange.push(i);
		};

		var windChart = dc.barChart("#chart9");
		windChart
			.width(300)
			.height(300)
			.dimension(ahc.dimensions.winds)
			.group(windgroup)
			.brushOn(false)
			.xUnits(dc.units.ordinal)
			.centerBar(false)
       		.elasticY(true)
			.x(d3.scale.ordinal().domain(windRange))
			.xAxisLabel("Wind Speed");

        ahc.dimensions.rains = ahc.crossStore.hist.dimension(function (d){ return d.rain});
        var rainRAWGroup = ahc.dimensions.rains.group();

		// create range.
		var minrain = 100;
		var maxrain = 0;
		var rainRange = []
        var raingroup = {
			all:function () {
				var g = [];
				rainRAWGroup.all().forEach(function(d,i){
					if (d.key !== NaN) {g.push(d);}
					minrain = minrain > d.rain? d.rain: minrain;
					maxrain = maxrain < d.rain? d.rain: maxrain;
				});
				return g;
			},
			top:function (k) {
				var g = [];
				rainRAWGroup.top(k).forEach(function(d,i){
					if (d.key !== NaN) {g.push(d);}
				});
				return g;
			}
		};

		raingroup.all();
		for (var i = minrain; i <= maxrain; i++) {
			rainRange.push(i);
		};

		var rainChart = dc.barChart("#chart10");
		rainChart
			.width(300)
			.height(300)
			.dimension(ahc.dimensions.rains)
			.group(raingroup)
			.brushOn(false)
			.xUnits(dc.units.ordinal)
			.centerBar(false)
       		.elasticY(true)
			.x(d3.scale.ordinal().domain(rainRange))
			.xAxisLabel("Rain");

		dc.renderAll(); 

	}

	ahc.init = function (){
		downloadData();
	};
	return ahc;
}(jQuery,crossfilter,d3,dc,AIRHACKCHARTS || {},UTILS);
