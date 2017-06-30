'use strict';

var os = require('os');
var client_id = os.hostname();
// var client_id = "rtv1";

var path = require('path');
var amino = require('./aminogfx-gl/main.js');


var gfx = new amino.AminoGfx();

// faces and their metadata
var faces = [];

var calibration_elements = [];

var root_group;

var crosshairs = {};

var stripes, stripes1, stripes2, stripes3;

var sweep_history = [];

var calibrate_mode = 0;

//////////////////
// Module

var Facemirror = require('./facemirror.js');
var fm = new Facemirror({"client_id":client_id,"env":"node"});
fm.foo();



///////////////////////////////////////////////

// MQTT connect 

const mqtt = require('mqtt')  
const client = mqtt.connect('mqtt://192.168.22.20')

client.on('connect', () => {  

  client.subscribe(client_id + '/#');
  client.subscribe('rtv_all/#');
  client.subscribe('sweep/#');

})

///////////////////////////////////////////////

// Amino start and custom fonts

gfx.start(function (err) {

    if (err) {
        console.log('Amino start failed: ' + err.message);
        return;
    }

    root_group = this.createGroup();
    this.setRoot(root_group);
  
    // onload
    draw_crosshairs();
    draw_stripes();
    main_loop();

    // draw_calibrate_img();

});

amino.fonts.registerFont({
    name: 'Monotxt',
    path: path.join(__dirname, 'fonts/'),
    weights: {
        200: {
            normal: 'MONOTXT_.TTF'
        }
    }
});

amino.fonts.registerFont({
    name: 'ISOCTEUR',
    path: path.join(__dirname, 'fonts/'),
    weights: {
        200: {
            normal: 'ISOCTEUR.TTF'
        }
    }
});

///////////////////////////////////////////////

// Drawing functions


client.on('message', (topic, message) => {  

    var topics = topic.split("/");
    var el_id = topics[2];

///////////////////////////////////////////////////////////////////

    if(topics[1] === 'calibrate') {
 
        calibrate_mode = 1;

        el_id = 0;

        if (typeof calibration_elements[el_id] === "undefined") {

            // create element
            console.log("NEW poly / ID:" + el_id);

            calibration_elements[el_id] = gfx.createPolygon();
            calibration_elements[el_id].fill("#FFFFFF");
            root_group.add(calibration_elements[el_id]);

        }

       var px_calib_x1 = 100;
        var px_calib_x2 = 1800;
        var px_calib_y1 = 100;
        var px_calib_y2 = 1000;


        var calib_coords = [px_calib_x1, px_calib_y1, px_calib_x2, px_calib_y1, px_calib_x2, px_calib_y2, px_calib_x1, px_calib_y2];

        calibration_elements[el_id].geometry(calib_coords);

        console.log("CALIBRATE " + calib_coords);

        draw_calibrate_img();

///////////////////////////////////////////////////////////////////

    } else if (topic === 'sweep/scan_xz'){

        var msg = message.toString();
        var map = JSON.parse(msg);

           // Clean history
          if (sweep_history.length > 10){
              sweep_history.pop();
          }

          // Add frame to history
          sweep_history.unshift(map); // The unshift() method adds new items to the beginning of an array, and returns the new length.


    } else if(topics[1] === 'face_new' && el_id) {

        // parse message
        var msg = message.toString();
        var faceframe = JSON.parse(msg);

        // Init face and save to history
        faces = fm.check_history(faceframe, faces);

        // Check face movement  
        faces = fm.check_move(faceframe, faces);

        // Check hiding timer
        check_hide(faceframe);



        // Real time drawings
        // draw_img(faceframe);
        
        // draw_facepoly(faceframe);

    
        // draw_stripes();


        // draw_text(faceframe);

        draw_square(faceframe);
        draw_dotface(faceframe);

            // console.log(faces[faceframe.id]["movement"]["status"]);
/*
        if(faces[faceframe.id]["movement"]["status"] == "still" && faces[faceframe.id]["crosshairs"]["status"] == "grid"){

            // console.log(faces[faceframe.id]["movement"]["status"]);

            faces[faceframe.id]["crosshairs"]["status"] = "anim";

            crosshairs_to_face(faceframe);

            setTimeout(function(faceframe){ faces[faceframe.id]["crosshairs"]["status"] = "grid"; },30000,faceframe);
            

        }

*/

    } 


})


////////////////////////////////////////////////////////////////////////////////

function main_loop(){

    move_stripes();

    // loop over all faces
    for (var i = 0; i < faces.length; i++) {

        
        // face_dislay(i);


    }


    setTimeout(function(){
        main_loop();
    },10);


} // function main_loop()


////////////////////////////////////////////////////////////////////////////////


function face_dislay(id){

    // hide show face
    if (faces[id]["hide"]["status"] == "hidden"){
        faces[id][el_id]["text"].opacity(0);
    } else {
        faces[id][el_id]["text"].opacity(1);
    }

} // face_dislay






///////////////////////////////////////////////

function check_hide(faceframe){

    var time_till_hide = 500; // ms

    // Initialize hiding    
    if(typeof faces[faceframe.id]["hide"] === "undefined"){
        faces[faceframe.id]["hide"] = {"timer":"","status":"visible"};
    }

    // New frame means it's visible
    faces[faceframe.id]["hide"]["status"] = "visible";

    // Stop hiding
    clearTimeout(faces[faceframe.id]["hide"]["timer"]);

    // Wait for hiding
    faces[faceframe.id]["hide"]["timer"] = setTimeout(function(faceframe){

         faces[faceframe.id]["hide"]["status"] = "hidden";

    },time_till_hide,faceframe);

} // check_hide




//////////////////////////////////////////////////////////////////
//
// DRAWING FUNCTIONS

var crosshair_offset_x = 333;
var crosshair_offset_y = 333;



//////////////////////////////////////////

function draw_crosshairs(){



var i = 0;

for (var x = 0; x < 12; x++) {

    for (var y = 0; y < 3; y++) {

        // var crosshair_id = x + "," + y;
        var crosshair_id = i;

        crosshairs[crosshair_id] = gfx.createImageView().opacity(1.0);
        crosshairs[crosshair_id].src("crosshair.png");

        var coords = [];
        coords[0] = fm.mm2px_x(x*333 + crosshair_offset_x);
        coords[1] = fm.mm2px_y(y*333 + crosshair_offset_y);

        crosshairs[crosshair_id].x(coords[0]);
        crosshairs[crosshair_id].y(coords[1]);

        crosshairs[crosshair_id].w(25);
        crosshairs[crosshair_id].h(25);

        root_group.add(crosshairs[crosshair_id]);

        i++;

    } // for y

} // for x


}

function crosshairs_to_face(faceframe){

var i = 0;


    for (var x = 0; x < 12; x++) {

        for (var y = 0; y < 3; y++) {
            
         
            var crosshair_id = i;

            var values = [crosshair_id,x,y];
           
            var from_x = fm.mm2px_x(x * 333 + crosshair_offset_x);
            var from_y = fm.mm2px_y(y * 333 + crosshair_offset_y);


            var coords_x = fm.mm2px_x(faceframe.landmarks_global_mm[i][0]);
            var coords_y = fm.mm2px_y(faceframe.landmarks_global_mm[i][1]);

            // crosshairs[crosshair_id].x.anim().from(from_x).to(coords_x).dur(2000).autoreverse(true).loop(-1).start();
            // crosshairs[crosshair_id].y.anim().from(from_y).to(coords_y).dur(2000).autoreverse(true).loop(-1).start();
      

            crosshairs[crosshair_id].x.anim().from(from_x).to(coords_x).delay(crosshair_id*200).dur(3000).start();
            crosshairs[crosshair_id].y.anim().from(from_y).to(coords_y).delay(crosshair_id*200).dur(3000).start();

            crosshairs[crosshair_id].x.anim().from(coords_x).to(from_x).delay(13000).dur(500).start();
            crosshairs[crosshair_id].y.anim().from(coords_y).to(from_y).delay(13000).dur(500).start();



            // crosshairs[crosshair_id].w.anim().from(50).to(25).delay(crosshair_id*300).dur(5000).start();
            // crosshairs[crosshair_id].h.anim().from(50).to(25).delay(crosshair_id*300).dur(5000).start();

            crosshairs[crosshair_id].size('stretch');

            
            i++;



        }

    }

}


//////////////////////////////////////////

function draw_img(faceframe){


    if(typeof faces[faceframe.id]["el"]["image"] === "undefined"){

        faces[faceframe.id]["el"]["image"] = gfx.createImageView().opacity(1.0);
        root_group.add(faces[faceframe.id]["el"]["image"]);
        console.log("NEW image / FACE_ID:" + faceframe.id);


    } 

    faces[faceframe.id]["el"]["image"].src(faceframe.face_image_url);

    var coords = [];
    coords[0] = fm.mm2px_x(faceframe.landmarks_global_mm[0][0]);
    coords[1] = 10;

    faces[faceframe.id]["el"]["image"].x(coords[0]);
    faces[faceframe.id]["el"]["image"].y(coords[1]);

    console.log("MOVE image / FACE_ID:" + faceframe.id + " x:" + coords[0] + " y:" + coords[1] +" " + faceframe.face_image_url);




} // draw img

//////////////////////////////////////////

var calibrate_img = null;



function draw_calibrate_img(){


    if(calibrate_img == null){

        calibrate_img = gfx.createImageView().opacity(1.0).x(640).y(20).w(640).h(480);
        root_group.add(calibrate_img);
        console.log("NEW calibrate image");

    } 


    calibrate_img.src("http://rtv0.local:8000/"+ client_id +"/frame.jpg?rand=" + Math.random() );
    // calibrate_img.src("http://192.168.22.100/rtv/img/loading_f1.png?rand=" + Math.random() );

    if( calibrate_mode == 1 ){

        setTimeout(function(){
            draw_calibrate_img();
        },200);

    }


} // draw draw_calibrate_img

///////////////////////////////////////////////


function draw_facepoly(faceframe){

   
    if(typeof faces[faceframe.id]["el"]["facepoly"] === "undefined"){

        faces[faceframe.id]["el"]["facepoly"] = gfx.createPolygon().opacity(1.0).fill("#FFFFFF");
        root_group.add(faces[faceframe.id]["el"]["facepoly"]);
        console.log("NEW facepoly / FACE_ID:" + faceframe.id);

    } 

    var geometry = [];

    for (var i = 0; i <= 16; i++) {
        geometry.push(faceframe.landmarks_global_mm[i]);
    }

    for (var i = 26; i >= 17; i--) {
        geometry.push(faceframe.landmarks_global_mm[i]);
    }

    var geometry2 = [];

    for (var i = 0; i < geometry.length; i++) {
        geometry2.push(fm.mm2px_x(geometry[i][0]));
        geometry2.push(fm.mm2px_y(geometry[i][1]));
    }

    faces[faceframe.id]["el"]["facepoly"].geometry(geometry2);

    console.log("MOVE facepoly / FACE_ID:" + faceframe.id + " geometry:" + geometry2);


}

//////////////////////////////////////////


function draw_dotface(faceframe){


    // initialize dotface

    if(typeof faces[faceframe.id]["el"]["dotface"] === "undefined"){

        faces[faceframe.id]["el"]["dotface"] = [];
        var box_width = 5; // in px

        for (var i = 0; i < faceframe.landmarks_global_mm.length; i++) {
            var coords_x = fm.mm2px_x(faceframe.landmarks_global_mm[i][0]);
            var coords_y = fm.mm2px_y(faceframe.landmarks_global_mm[i][1]);

            faces[faceframe.id]["el"]["dotface"][i] = gfx.createRect().x(coords_x-box_width/2).y(coords_y).w(box_width).h(box_width).fill('#FFFFFF').opacity(1.0);
            root_group.add(faces[faceframe.id]["el"]["dotface"][i]);
        } // for

        console.log("NEW dotface / FACE_ID:" + faceframe.id);

    }

    // move landmark points to new coordinates
    for (var i = 0; i < faceframe.landmarks_global_mm.length; i++) {

        // current frame
        var coords_x = fm.mm2px_x(faceframe.landmarks_global_mm[i][0]);
        var coords_y = fm.mm2px_y(faceframe.landmarks_global_mm[i][1]);

        // last frame
        if (faces[faceframe.id]["history"].length>1){
            var previous_faceframe = faces[faceframe.id]["history"][1];
        } else {
            var previous_faceframe = faces[faceframe.id]["history"][0];
        }
        var from_x = fm.mm2px_x(previous_faceframe.landmarks_global_mm[i][0]);
        var from_y = fm.mm2px_y(previous_faceframe.landmarks_global_mm[i][1]);

        // animation
        // faces[faceframe.id]["el"]["dotface"][i].x.anim().from(from_x).to(coords_x).dur(100).start();
        // faces[faceframe.id]["el"]["dotface"][i].y.anim().from(from_y).to(coords_y).dur(100).start();

        // fast move
        faces[faceframe.id]["el"]["dotface"][i].x(coords_x);
        faces[faceframe.id]["el"]["dotface"][i].y(coords_y);


    } // for


    console.log("MOVE dotface / FACE_ID:" + faceframe.id + " x:" + coords_x + ",y:" + coords_y);


}


//////////////////////////////////////////

function draw_square(faceframe){

    var map = faceframe.landmarks_global_mm;

    var max_x = 0;
    var max_y = 0;

    var min_x = 5000;
    var min_y = 5000;

    for (var i = 0; i < map.length; i++) {

        // map[i][1] = map[i][1] - 40;

        if(fm.mm2px_x(map[i][0]) > max_x){ max_x = fm.mm2px_x(map[i][0]); }
        if(fm.mm2px_y(map[i][1]) > max_y){ max_y = fm.mm2px_y(map[i][1]); }

        if(fm.mm2px_x(map[i][0]) < min_x){ min_x = fm.mm2px_x(map[i][0]); }
        if(fm.mm2px_y(map[i][1]) < min_y){ min_y = fm.mm2px_y(map[i][1]); }
   }


   var width = Math.abs(max_x - min_x);
   var height = Math.abs(max_y - min_y);
   // console.log(width + " " + height);

   if(width > 600 || height > 600 || width < 30 || height < 30){
    var square_side = 200;
   } else if(width > height){
    var square_side = width;
   } else {
    var square_side = height;
   }


    var thirdeye_y = fm.mm2px_y(map[27][1]);
    var face_bottom_y = fm.mm2px_y(map[8][1]);

    var square_side_px = (face_bottom_y - thirdeye_y)*2;


    var coords_x_rect = fm.mm2px_x(map[27][0]) - square_side_px/2;
    var coords_y_rect = fm.mm2px_y(map[27][1]) - square_side_px/2;

    console.log(square_side_px + " square side");

   
    if(typeof faces[faceframe.id]["el"]["square"] === "undefined"){

        faces[faceframe.id]["el"]["square"] = gfx.createRect().x(coords_x_rect).y(coords_y_rect).w(10).h(10).fill("#000000").opacity(1.0);
        root_group.add(faces[faceframe.id]["el"]["square"]);
        console.log("NEW square / FACE_ID:" + faceframe.id);

        faces[faceframe.id]["el"]["square"].w.anim().from(10).to(square_side_px).dur(1000).start();
        faces[faceframe.id]["el"]["square"].h.anim().from(10).to(square_side_px).dur(1000).delay(1000).start();

        faces[faceframe.id]["square"] = {"previous_pos":[coords_x_rect,coords_y_rect]};

    } 

    faces[faceframe.id]["el"]["square"].x.anim().from(faces[faceframe.id]["square"]["previous_pos"][0]).to(coords_x_rect).dur(200).start();
    faces[faceframe.id]["el"]["square"].y.anim().from(faces[faceframe.id]["square"]["previous_pos"][1]).to(coords_y_rect).dur(200).start();
            
    faces[faceframe.id]["square"]["previous_pos"] = [coords_x_rect,coords_y_rect];
    console.log("MOVE square / FACE_ID:" + faceframe.id + " geometry:" + faces[faceframe.id]["square"]["previous_pos"] );


}

//////////////////////////////////////////



function draw_text(faceframe){

      
    var map = faceframe.landmarks_global_mm;
    var coords_x = fm.mm2px_x(map[30][0])-200;
    var coords_y = fm.mm2px_y(map[30][1])-50;

    if(typeof faces[faceframe.id]["el"]["text"] === "undefined"){

        faces[faceframe.id]["el"]["text"] = gfx.createText().x(coords_x).y(coords_y).fontSize(40).fontName('ISOCTEUR').text("face_id: " + faceframe.face_id).fontWeight(200);
        root_group.add(faces[faceframe.id]["el"]["text"]);
        console.log("NEW text / FACE_ID:" + faceframe.id);
        faces[faceframe.id]["z_history"] = [];

    } 


    var current_lidar_z = sweep_get_z(map[30][0]);
    var current_nose_z = Math.round(faceframe.nose_global_mm[2]);

    if (current_lidar_z != null){

        var z_offset = current_nose_z / current_lidar_z;


        faces[faceframe.id]["z_history"].unshift(z_offset);
        console.log(faces[faceframe.id]["z_history"]);

    }

        
    var z_offset_avg = arr.median(faces[faceframe.id]["z_history"]);


    var text_str = "lidar=" + current_lidar_z + "mm / opencv=" + current_nose_z + "mm / "+ z_offset.toFixed(4);

    // move text
    faces[faceframe.id]["el"]["text"].x(coords_x);
    faces[faceframe.id]["el"]["text"].y(coords_y);

    faces[faceframe.id]["el"]["text"].text(text_str);


    console.log("MOVE text / FACE_ID:" + faceframe.id + " geometry:" + coords_x + " y:" + coords_y);


} // if draw_text(faceframe)

//////////////////////////////////////////

function sweep_get_z(x){

var close_points = [];

    for (var i = 0; i < sweep_history.length; i++) {

        for (var j = 0; j < sweep_history[i].length; j++) {

            if(Math.abs(sweep_history[i][j][0]- x) < 80 && sweep_history[i][j][1]>10  && sweep_history[i][j][1]< 4000){

                close_points.unshift(sweep_history[i][j][1]);

            } // if

        } // for
    
     } // for

var total = 0;

// console.log(close_points);

var average_z = arr.median(close_points);
/*
for (var i = 0; i < close_points.length; i++) {
    total += close_points[i];
}

var average_z = Math.round(total / i);
*/
return average_z;

}



//////////////////////////////////////////

function draw_stripes(){

    stripes1 = gfx.createImageView().opacity(1.0).w(1920).h(1000).x(0).y(0).src("triibustik1000.png");
    stripes2 = gfx.createImageView().opacity(1.0).w(1920).h(1000).x(0).y(1000).src("triibustik1000.png");
    stripes3 = gfx.createImageView().opacity(1.0).w(1920).h(1000).x(0).y(2000).src("triibustik1000.png");

    stripes  = gfx.createGroup();
    stripes.add(stripes1);
    stripes.add(stripes2);
    stripes.add(stripes3);
    root_group.add(stripes);

}

function move_stripes(){

    if (stripes.y.value < -1000){
      stripes.y(0);
    } else {
      stripes.y(stripes.y.value-0.2);
    }

}

/////////////////////////////////////////////////////////////////////////////////////

// Statistical functions

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

//////////////////////////////////     
