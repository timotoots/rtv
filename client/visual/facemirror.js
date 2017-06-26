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
    mm_calibs["rtv1"]["mm_calib_x1"] = 205;
    mm_calibs["rtv1"]["mm_calib_x2"] = 1320;
    mm_calibs["rtv1"]["mm_calib_y1"] = 210;
    mm_calibs["rtv1"]["mm_calib_y2"] = 803;

    mm_calibs["rtv2"]["mm_calib_x1"] = 1447;
    mm_calibs["rtv2"]["mm_calib_x2"] = 2563;
    mm_calibs["rtv2"]["mm_calib_y1"] = 210;
    mm_calibs["rtv2"]["mm_calib_y2"] = 803;

    mm_calibs["rtv3"]["mm_calib_x1"] = 2691;
    mm_calibs["rtv3"]["mm_calib_x2"] = 3807;
    mm_calibs["rtv3"]["mm_calib_y1"] = 210;
    mm_calibs["rtv3"]["mm_calib_y2"] = 803;

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

        

    ///////////////////////////////////////////////////////////////////////////////
    //
    //  Analyze movement

    Facemirror.prototype.check_move = function check_move(faceframe, faces){

    if(typeof faces[faceframe.id]["movement"] === "undefined"){

        faces[faceframe.id]["movement"] = {"status":"moving"};

    }

    // console.log(faces[faceframe.id]["movement"]);


    // current coordinates of the nose
    var coords_x = this.mm2px_x(faceframe.nose_global_mm[0]);
    var coords_y = this.mm2px_y(faceframe.nose_global_mm[1]);
 
    var movement_tolerance_mm = 50;

    // how many samples we use in the average
    if (faces[faceframe.id]["history"].length > 20){
        var samples_for_average = 20;
    } else {
        var samples_for_average = faces[faceframe.id]["history"].length ;
    }

    // calculate average
    var total_x = 0;
    var total_y = 0;
    for (var i = 0; i < samples_for_average; i++) {
        
        total_x +=  faces[faceframe.id]["history"][i].nose_global_mm[0];
        total_y +=  faces[faceframe.id]["history"][i].nose_global_mm[1];

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
        faces[faceframe.id]["movement"]["still_coords"] = coords_x + "," + coords_y;

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
          faces[faceframe.id] = { "history":[], "el":{}, "crosshairs":{ "status":"grid"} };
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




    return Facemirror;
    
  })();

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined')
    module.exports = Facemirror;
  else
    window.Facemirror = Facemirror;
})();
