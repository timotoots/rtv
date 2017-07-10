(function() {
  var Facemirror = (function() {


    // Global variables

    // in pixels on screen
    var px_calib_x1 = 100;
    var px_calib_x2 = 1800;
    var px_calib_y1 = 100;
    var px_calib_y2 = 1000;

    var mm_calibs = {"rtv1":{},"rtv2":{},"rtv3":{}};

    // in mm from mirror top
    mm_calibs["rtv1"]["mm_calib_x1"] = 200;
    mm_calibs["rtv1"]["mm_calib_x2"] = 1318;
    mm_calibs["rtv1"]["mm_calib_y1"] = 207;
    mm_calibs["rtv1"]["mm_calib_y2"] = 801; 

    mm_calibs["rtv2"]["mm_calib_x1"] = 1446;
    mm_calibs["rtv2"]["mm_calib_x2"] = 2560;
    mm_calibs["rtv2"]["mm_calib_y1"] = 209;
    mm_calibs["rtv2"]["mm_calib_y2"] = 803;

    mm_calibs["rtv3"]["mm_calib_x1"] = 2688;
    mm_calibs["rtv3"]["mm_calib_x2"] = 3803;
    mm_calibs["rtv3"]["mm_calib_y1"] = 208;
    mm_calibs["rtv3"]["mm_calib_y2"] = 801;

    var mm_screen_offset_from_mirror_x, mm_screen_offset_from_mirror_y, px_per_mm_x, px_per_mm_y;


    var client_id;


    ///////////////////////////////////////////////////////////////////////////////
    // Init Function

    var Facemirror = function(options) {


      client_id = options["client_id"];

      var mm_calib_dist_x = mm_calibs[client_id]["mm_calib_x2"] - mm_calibs[client_id]["mm_calib_x1"];
      var mm_calib_dist_y = mm_calibs[client_id]["mm_calib_y2"] - mm_calibs[client_id]["mm_calib_y1"];

      var px_calib_dist_x = px_calib_x2 - px_calib_x1;
      var px_calib_dist_y = px_calib_y2 - px_calib_y1;

      px_per_mm_x = px_calib_dist_x / mm_calib_dist_x;
      px_per_mm_y = px_calib_dist_y / mm_calib_dist_y;

      mm_screen_offset_from_mirror_y = mm_calibs[client_id]["mm_calib_y1"] - px_calib_y1 / px_per_mm_y;
      mm_screen_offset_from_mirror_x = mm_calibs[client_id]["mm_calib_x1"] - px_calib_x1 / px_per_mm_x;

     
    };



      ///////////////////////////////////////////////////////////////////////////////
      // Calibrarion functions


       Facemirror.prototype.mm2px_x = function mm2px_x(value_mm){

        return (value_mm - mm_screen_offset_from_mirror_x)  *  px_per_mm_x;      

        }


       Facemirror.prototype.mm2px_y = function mm2px_y(value_mm){

        return (value_mm - mm_screen_offset_from_mirror_y)  *  px_per_mm_y;      

        }


        Facemirror.prototype.foo = function foo() {
        
          // console.log(faces);

        };


        Facemirror.prototype.process_faceframe = function process_faceframe(faceframe) {


            if(faceframe["landmarks_global_mm"][45][0] - faceframe["landmarks_global_mm"][36][0] > 50 || faceframe["landmarks_global_mm"][45][0] - faceframe["landmarks_global_mm"][36][0] < 30){
                // console.log("weird face ID:" + faceframe.face_id);
                return false;
            }
        
            
            faceframe["center_point_nose"] = [ faceframe["nose_global_mm"][0],faceframe["nose_global_mm"][1] ];

            var all_x = [];
            var all_y = [];

            for (var i = 0; i < faceframe["landmarks_global_mm"].length; i++) {
                all_x.unshift(faceframe["landmarks_global_mm"][i][0]);
                all_y.unshift(faceframe["landmarks_global_mm"][i][1]);
                }

            faceframe["center_point_all_median"] = [ arr.median(all_x), arr.median(all_y) ];
            faceframe["center_point_all_average"] = [ arr.mean(all_x), arr.mean(all_y) ];

            for (var i = 36; i <= 47; i++) {
                all_x.unshift(faceframe["landmarks_global_mm"][i][0]);
                all_y.unshift(faceframe["landmarks_global_mm"][i][1]);
            }

            faceframe["center_point_eyes_median"] = [ arr.median(all_x), arr.median(all_y) ];

            faceframe["center_point_mideyes"] = [ faceframe["landmarks_global_mm"][27][0],faceframe["landmarks_global_mm"][27][1] ];

            faceframe["supermiddle"] = [];
            faceframe["supermiddle"][0] = (faceframe["center_point_eyes_median"][0] + faceframe["center_point_mideyes"][0] +  faceframe["center_point_all_median"][0] +  faceframe["center_point_all_median"][0])/4;
            faceframe["supermiddle"][1] = (faceframe["center_point_eyes_median"][1] + faceframe["center_point_mideyes"][1] +  faceframe["center_point_all_median"][1] +  faceframe["center_point_all_median"][1])/4;

            var d = new Date();
            faceframe["time"] = d.getTime();

            return faceframe;

        };
        

    ///////////////////////////////////////////////////////////////////////////////
    //
    //  Analyze movement

    Facemirror.prototype.check_move = function check_move(faceframe, faces){

    if(typeof faces[faceframe.id]["movement"] === "undefined"){

        faces[faceframe.id]["movement"] = {"status":"moving", "still_timer":"stopped", "square_status":"hidden"};

    }

    // console.log(faces[faceframe.id]["movement"]);


    // current coordinates of the nose
    var coords_x = this.mm2px_x(faceframe.supermiddle[0]);
    var coords_y = this.mm2px_y(faceframe.supermiddle[1]);
 
    var movement_tolerance_mm = 20;

    // how many samples we use in the average
    if (faces[faceframe.id]["history"].length > 3){
        var samples_for_average = 3;
    } else {
        var samples_for_average = faces[faceframe.id]["history"].length ;
    }

    // calculate average
    var total_x = 0;
    var total_y = 0;
    for (var i = 0; i < samples_for_average; i++) {
        
        total_x +=  faces[faceframe.id]["history"][i].supermiddle[0];
        total_y +=  faces[faceframe.id]["history"][i].supermiddle[1];

    }

    var avg_x = this.mm2px_x(total_x / samples_for_average);
    var avg_y = this.mm2px_y(total_y / samples_for_average);

    // console.log( "Average X:" + avg_x + " / now " + coords_x);
    // console.log( "Average Y:" + avg_y + " / now " + coords_y);



    if( Math.abs(avg_x - coords_x) > movement_tolerance_mm || Math.abs(avg_y - coords_y) > movement_tolerance_mm){

        // current coordinates are different from average
        faces[faceframe.id]["movement"]["status"] = "moving";

    

    } else if(faces[faceframe.id]["movement"]["status"] == "moving") {

        // console.log("STILLLL");
        faces[faceframe.id]["movement"]["status"] = "still";
        //faces[faceframe.id]["movement"]["still_coords"] = [(total_x / samples_for_average),(total_y / samples_for_average)];
        faces[faceframe.id]["movement"]["still_coords"] = [faceframe.supermiddle[0],faceframe.supermiddle[1]];

        var d = new Date();
        faces[faceframe.id]["movement"]["still_time"] = d.getTime();
    
    }

return faces;


} // function check_move(faceframe)

    Facemirror.prototype.check_history = function check_history(faceframe, faces){


      var found = 0;

      // if face exists
      for (var i = 0; i < faces.length; i++) {

          if (faces[i]["history"][0].face_id == faceframe.face_id){
              faceframe.id = i;
              found = 1;

          }
      }

      // Register new face
      if (found == 0){
          // new internal id, not the same as face_id
          faceframe.id = faces.length;
          faces[faceframe.id] = { "history":[], "el":{}, "crosshairs":{ "status":"grid"}, "status":"active" };
          console.log("NEW FACE id: " + faceframe.id);  
          // crosshairs_to_face(faceframe);
       
      } 


      // Clean history
      if (faces[faceframe.id]["history"].length > 20){
          faces[faceframe.id]["history"].pop();
      }

      // Add frame to history
      faces[faceframe.id]["history"].unshift(faceframe); // The unshift() method adds new items to the beginning of an array, and returns the new length.

      return faces;


    }


      ///////////////////////////////////////////////////////////////////////////////


// Helper functions

var arr = {   
    max: function(array) {
        return Math.max.apply(null, array);
    },
    
    min: function(array) {
        return Math.min.apply(null, array);
    },
    
    range: function(array) {
        return arr.max(array) - arr.min(array);
    },
    
    midrange: function(array) {
        return arr.range(array) / 2;
    },

    sum: function(array) {
        var num = 0;
        for (var i = 0, l = array.length; i < l; i++) num += array[i];
        return num;
    },
    
    mean: function(array) {
        return arr.sum(array) / array.length;
    },
    
    median: function(array) {
        array.sort(function(a, b) {
            return a - b;
        });
        var mid = array.length / 2;
        return mid % 1 ? array[mid - 0.5] : (array[mid - 1] + array[mid]) / 2;
    },
    
    modes: function(array) {
        if (!array.length) return [];
        var modeMap = {},
            maxCount = 0,
            modes = [];

        array.forEach(function(val) {
            if (!modeMap[val]) modeMap[val] = 1;
            else modeMap[val]++;

            if (modeMap[val] > maxCount) {
                modes = [val];
                maxCount = modeMap[val];
            }
            else if (modeMap[val] === maxCount) {
                modes.push(val);
                maxCount = modeMap[val];
            }
        });
        return modes;
    },
    
    variance: function(array) {
        var mean = arr.mean(array);
        return arr.mean(array.map(function(num) {
            return Math.pow(num - mean, 2);
        }));
    },
    
    standardDeviation: function(array) {
        return Math.sqrt(arr.variance(array));
    },
    
    meanAbsoluteDeviation: function(array) {
        var mean = arr.mean(array);
        return arr.mean(array.map(function(num) {
            return Math.abs(num - mean);
        }));
    },
    
    zScores: function(array) {
        var mean = arr.mean(array);
        var standardDeviation = arr.standardDeviation(array);
        return array.map(function(num) {
            return (num - mean) / standardDeviation;
        });
    }
};





    return Facemirror;
    
  })();

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined')
    module.exports = Facemirror;
  else
    window.Facemirror = Facemirror;
})();
