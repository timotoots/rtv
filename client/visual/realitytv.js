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

var lidar_bar = {};
var lidar_bar_width_mm = 100;

var stripes_coverbox;
var persons_side = "L";

var reality = {"lidar_persons":0,"stripes_fading":0};

var params = {"square_color":"#FFFFFF","lidar_color":"#FF0000", "stripes":"off", "draw_dotface":"off","draw_lidar":"off","draw_text":"off","draw_animated_square":"off","draw_square_realtime":"off","draw_square":"off" };

//////////////////
// Module

var Facemirror = require('./facemirror.js');
var fm = new Facemirror({"client_id":client_id,"env":"node"});
fm.foo();



////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

// MQTT connect 

const mqtt = require('mqtt')  
const client = mqtt.connect('mqtt://192.168.22.20')

client.on('connect', () => {  

  client.subscribe(client_id + '/#');
  client.subscribe('rtv_all/#');
  client.subscribe('sweep/#');

})

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

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
    init_lidar_bar();
    lidar_loop();
    stripes_loop();
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

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

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
          if (sweep_history.length > 2){
              sweep_history.pop();
          }
          var new_map = [];

          for (var i = 0; i < map.length; i++) {

              if (map[i][1] > 10 && map[i][1] < 3500 && map[i][0] > 0 && map[i][0] < 4000){
                new_map.unshift(map[i]);
              }
          }

          // Add frame to history
          sweep_history.unshift(new_map); // The unshift() method adds new items to the beginning of an array, and returns the new length.

    } else if(topics[1] === 'params' && el_id){

    	change_params(el_id, message.toString());

    } else if(topics[1] === 'face_new' && el_id) {

        // parse message
        var msg = message.toString();
        var faceframe = JSON.parse(msg);


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

          // console.log(faceframe);





        // Init face and save to history
        faces = fm.check_history(faceframe, faces);

        // Check face movement  
        faces = fm.check_move(faceframe, faces);

        // Check hiding timer
        check_hide(faceframe);


        // Real time drawings
        // draw_img(faceframe);
        draw_realtime_square(faceframe);
        // draw_facepoly(faceframe);


		if(faces[faceframe.id]["movement"]["status"] == "still"  && params["draw_animated_square"]=="on"){
			draw_animated_square(faceframe);
			// draw_square(faceframe);
		}

		// if( faces[faceframe.id]["movement"]["status"] == "still" && params["draw_square"]=="on"){
		// 	// console.log("squar!!!!");
	
		// }

		// draw_square(faceframe);

		// if(params["draw_square_realtime"]=="on"){
		// 	draw_square(faceframe);
		// }


		if(params["draw_text"]=="on"){
			draw_text(faceframe);
		}

		if(params["draw_dotface"]=="on"){
			draw_dotface(faceframe);
		}


        draw_reddot(faceframe);

		/*

        if(faces[faceframe.id]["movement"]["status"] == "still" && faces[faceframe.id]["movement"]["still_timer"] == "stopped"){


            faces[faceframe.id]["movement"]["still_timer"] = "started";

            // crosshairs_to_face(faceframe);

            setTimeout(function(faceframe){ faces[faceframe.id]["movement"]["still_timer"] = "stopped"; },1000,faceframe);
            

        }
        */




    } 


})

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

function change_params(id, val){

	if (typeof params[id] != undefined){

		params[id] = val;

	}


}


////////////////////////////////////////////////////////////////////////////////


function main_loop(){

    // loop over all faces
    for (var i = 0; i < faces.length; i++) {
        
        if(params["draw_animated_square"]=="on"){

	        	  // face_dislay(i);
	        if (faces[i]["el"]["anim_square_pattern"].y.value < -800){
	            faces[i]["el"]["anim_square_pattern"].y(0);

	        } else {
	            faces[i]["el"]["anim_square_pattern"].y(faces[i]["el"]["anim_square_pattern"].y.value-2);

	        }


        }
      


    }

    setTimeout(function(){
        main_loop();
    },10);


} // function main_loop()


function stripes_loop(){

    move_stripes();

    setTimeout(function(){
        stripes_loop();
    },10);


} // function main_loop()


////////////////////////////////////////////////

function init_lidar_bar(){

    var bar_width_px = fm.mm2px_x(1000+lidar_bar_width_mm*2) - fm.mm2px_x(1000+lidar_bar_width_mm);

    for (var i = 0; i < 4000; i = i + lidar_bar_width_mm) {
        
        lidar_bar[i] = {};
        var coords_x = fm.mm2px_x(i);
        lidar_bar[i].el = gfx.createRect().x(coords_x-bar_width_px/2).w(bar_width_px).y(2000).h(10).fill(params["lidar_color"]).opacity(1.0);
                 

        root_group.add(lidar_bar[i].el);

    }
    
    // console.log(lidar_bar);



}

////////////////////////////////////////////////

function lidar_loop(){


 for (var i = 0; i < 4000; i = i + lidar_bar_width_mm) {
      lidar_bar[i].z_average = 0;
      lidar_bar[i].el.fill(params["lidar_color"]);

}

    if(typeof sweep_history[0] != "undefined"){

        var z_points = {};


        for (var j = 0; j < sweep_history.length; j++) {
   

            for (var i = 0; i < sweep_history[j].length; i++) {


                var lidar_slot_id = Math.round(sweep_history[j][i][0] / lidar_bar_width_mm) * lidar_bar_width_mm;
             

                if (typeof lidar_bar[lidar_slot_id] != "undefined"){

                    if (typeof z_points[lidar_slot_id] === "undefined"){
                        z_points[lidar_slot_id] = [];
                    }

                   z_points[lidar_slot_id].unshift(sweep_history[j][i][1]);
                } 
            }

        }

        // add average to lidar_bar

        // console.log(z_points);


        Object.keys(z_points).forEach(function(key) {

             lidar_bar[key].z_average = arr.median(z_points[key]);

        });

      


    }

    var person_seen = 0;

    for (var i = 0; i < 4000; i = i + lidar_bar_width_mm) {
        if (lidar_bar[i].z_average != 0) {

            var opacity = lidar_bar[i].z_average/3500;
            opacity = 1;
            lidar_bar[i].el.opacity(opacity);
            person_seen = 1;

        } else {

            lidar_bar[i].el.opacity(0);
     
        }

        if( params["draw_lidar"] == "on"){
        	lidar_bar[i].el.y(1032);
        } else {
        	lidar_bar[i].el.y(2000);
        }        
     


    }

        var cover_box_width = fm.mm2px_x(4000) - fm.mm2px_x(0);

    // animate stripes on  - coverbox move out
    if(person_seen == 1 && reality["lidar_persons"]==0 && reality["stripes_fading"]==0){

        console.log("stripes ON");
        reality["lidar_persons"] = 1;
        reality["stripes_fading"] = 1;


        if(persons_side == "L"){
            var current_pos = fm.mm2px_x(0);
            var to_pos = fm.mm2px_x(4000);
            persons_side = "R";
        } else {
            var current_pos = fm.mm2px_x(0);
            var to_pos = fm.mm2px_x(-4000);
            persons_side = "L";

        }

     

        stripes_coverbox.x.anim().from(current_pos).to(to_pos).dur(2000).start();
        stripes_coverbox.opacity.anim().from(1).to(0).delay(2000).dur(1).start();


        setTimeout(function(){
         reality["stripes_fading"] = 0;
        },2200);

    // animate stripes off - coverbox fade in

    } else if(person_seen == 0 && reality["lidar_persons"]>0 && reality["stripes_fading"]==0){

        console.log("stripes OFF");


        reality["stripes_fading"] = 1;
        reality["lidar_persons"] = 0;

        var to_pos = fm.mm2px_x(0);

        stripes_coverbox.x(to_pos);
        stripes_coverbox.opacity.anim().from(0).to(1).delay(100).dur(2000).start();

        setTimeout(function(){
         reality["stripes_fading"] = 0;
        },2200);

    }




 setTimeout(function(){
        lidar_loop();
    },10);

}


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

function create_pattern_group(faceframe){


    faces[faceframe.id]["el"]["anim_square_pattern_group"] = gfx.createGroup().x(0).y(0).w(200).h(200).clipRect(true);

    faces[faceframe.id]["el"]["anim_square_pattern"] = gfx.createImageView().opacity(1.0).w(1000).h(1000).x(0).y(0);
    faces[faceframe.id]["el"]["anim_square_pattern"].src("stripes90.png");
    // faces[faceframe.id]["el"]["anim_square_pattern"].right(2).bottom(2).repeat('repeat');
    faces[faceframe.id]["el"]["anim_square_pattern_group"].add(faces[faceframe.id]["el"]["anim_square_pattern"]);

    root_group.add(faces[faceframe.id]["el"]["anim_square_pattern_group"]);


}

function hide_animated_square(faceframe){

    faces[faceframe.id]["el"]["anim_square_pattern_group"].opacity.anim().from(1).to(0).dur(500).start();
    
}

function draw_animated_square(faceframe){

    var map = faceframe.landmarks_global_mm;
 
    var coords_x_rect = fm.mm2px_x( faces[faceframe.id]["movement"]["still_coords"][0]);
    var coords_y_rect = fm.mm2px_y( faces[faceframe.id]["movement"]["still_coords"][1]-20);

        var square_side_px = 200;

	coords_x_rect = coords_x_rect - square_side_px/2;
    coords_y_rect = coords_y_rect - square_side_px/2;

    if(typeof faces[faceframe.id]["el"]["anim_square_pattern"]=== "undefined"){

        create_pattern_group(faceframe);
  

      
        console.log("NEW square / FACE_ID:" + faceframe.id);

        faces[faceframe.id]["square"] = {"previous_pos":[coords_x_rect,coords_y_rect]};

    } 


    faces[faceframe.id]["el"]["anim_square_pattern_group"].opacity.anim().from(1).to(1).dur(200).start();


    faces[faceframe.id]["el"]["anim_square_pattern_group"].x.anim().from(faces[faceframe.id]["square"]["previous_pos"][0]).to(coords_x_rect).dur(200).start();
    faces[faceframe.id]["el"]["anim_square_pattern_group"].y.anim().from(faces[faceframe.id]["square"]["previous_pos"][1]).to(coords_y_rect).dur(200).start();

         
    faces[faceframe.id]["square"]["previous_pos"] = [coords_x_rect,coords_y_rect];
    console.log("MOVE square / FACE_ID:" + faceframe.id + " geometry:" + faces[faceframe.id]["square"]["previous_pos"] );


// loading_f0.png

}



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
        var box_width = 2; // in px

        for (var i = 0; i < faceframe.landmarks_global_mm.length; i++) {
            var coords_x = fm.mm2px_x(faceframe.landmarks_global_mm[i][0]);
            var coords_y = fm.mm2px_y(faceframe.landmarks_global_mm[i][1]);

            faces[faceframe.id]["el"]["dotface"][i] = gfx.createRect().x(coords_x-box_width/2).y(coords_y).w(box_width).h(box_width).fill('#FFFFFF').opacity(1.0);
            root_group.add(faces[faceframe.id]["el"]["dotface"][i]);
        } // for

            var box_width = 5; // in px

            var coords_x = fm.mm2px_x(faceframe.supermiddle[0]);
            var coords_y = fm.mm2px_y(faceframe.supermiddle[1]);

            faces[faceframe.id]["el"]["dotface"][100] = gfx.createRect().x(coords_x-box_width/2).y(coords_y).w(box_width).h(box_width).fill('#FF0000').opacity(1.0);
            root_group.add(faces[faceframe.id]["el"]["dotface"][100]);

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

        // colordots
        var coords_x = fm.mm2px_x(faceframe.supermiddle[0]);
        var coords_y = fm.mm2px_y(faceframe.supermiddle[1]);
        faces[faceframe.id]["el"]["dotface"][100].x(coords_x);
        faces[faceframe.id]["el"]["dotface"][100].y(coords_y);


    } // for


    console.log("MOVE dotface / FACE_ID:" + faceframe.id + " x:" + coords_x + ",y:" + coords_y);


}

function draw_reddot(faceframe){


    // initialize dotface

    if(typeof faces[faceframe.id]["el"]["dotface"] === "undefined"){

        faces[faceframe.id]["el"]["dotface"] = [];

     
            var box_width = 5; // in px

            var coords_x = fm.mm2px_x(faceframe.supermiddle[0]);
            var coords_y = fm.mm2px_y(faceframe.supermiddle[1]);

            faces[faceframe.id]["el"]["dotface"][100] = gfx.createRect().x(coords_x-box_width/2).y(coords_y).w(box_width).h(box_width).fill('#FF0000').opacity(1.0);
            root_group.add(faces[faceframe.id]["el"]["dotface"][100]);

        console.log("NEW dotface / FACE_ID:" + faceframe.id);

    }


        // colordots
        var coords_x = fm.mm2px_x(faceframe.supermiddle[0]);
        var coords_y = fm.mm2px_y(faceframe.supermiddle[1]);
        faces[faceframe.id]["el"]["dotface"][100].x(coords_x);
        faces[faceframe.id]["el"]["dotface"][100].y(coords_y);




    console.log("MOVE dotface / FACE_ID:" + faceframe.id + " x:" + coords_x + ",y:" + coords_y);


}
//////////////////////////////////////////

function draw_square(faceframe){


    var square_side_px = 200;
   
    // Create element
    if(typeof faces[faceframe.id]["el"]["square"] === "undefined"){

        faces[faceframe.id]["el"]["square"] = gfx.createRect().x(0).y(0).w(0).h(0).opacity(1);
        faces[faceframe.id]["el"]["square2"] = gfx.createRect().x(0).y(0).w(0).h(0).opacity(1);

        root_group.add(faces[faceframe.id]["el"]["square"]);
                root_group.add(faces[faceframe.id]["el"]["square2"]);

        console.log("NEW square / FACE_ID:" + faceframe.id);
        // faces[faceframe.id]["square"] = {"previous_pos":[coords_x_rect,coords_y_rect]};

    }  
 

    faces[faceframe.id]["el"]["square"].fill(params["square_color"]);
    faces[faceframe.id]["el"]["square2"].fill("#000000");

    // var coords_x_rect = fm.mm2px_x(faceframe.supermiddle[0]) - square_side_px/2;
    // var coords_y_rect = fm.mm2px_y(faceframe.supermiddle[1]-20) - square_side_px/2;
    

    // console.log("draw_square " + faces[faceframe.id]["movement"]);

    var coords_x_rect = fm.mm2px_x( faces[faceframe.id]["movement"]["still_coords"][0]);
    var coords_y_rect = fm.mm2px_y( faces[faceframe.id]["movement"]["still_coords"][1]-20);

            
    if (faces[faceframe.id]["movement"]["status"]=="still" && faces[faceframe.id]["movement"]["square_status"] == "hidden" ){

        faces[faceframe.id]["movement"]["square_status"] = "animating";
      
    
        faces[faceframe.id]["el"]["square"].x(coords_x_rect-square_side_px/2);
        faces[faceframe.id]["el"]["square"].y(coords_y_rect-square_side_px/2);

        faces[faceframe.id]["el"]["square2"].x(coords_x_rect-square_side_px/2+10);
        faces[faceframe.id]["el"]["square2"].y(coords_y_rect-square_side_px/2+10);

        // faces[faceframe.id]["el"]["square"].opacity.anim().from(0).to(1).delay(10).dur(400).start();
    

        faces[faceframe.id]["el"]["square"].x.anim().from(coords_x_rect).to(coords_x_rect-square_side_px/2).dur(1000).start();
        faces[faceframe.id]["el"]["square"].y.anim().from(coords_y_rect).to(coords_y_rect-square_side_px/2).dur(1000).start();
        faces[faceframe.id]["el"]["square"].w.anim().from(0).to(square_side_px).dur(1000).start();
        faces[faceframe.id]["el"]["square"].h.anim().from(0).to(square_side_px).dur(1000).start();

        faces[faceframe.id]["el"]["square2"].x.anim().from(coords_x_rect).to(coords_x_rect-square_side_px/2+10).dur(1000).start();
        faces[faceframe.id]["el"]["square2"].y.anim().from(coords_y_rect).to(coords_y_rect-square_side_px/2+10).dur(1000).start();
        faces[faceframe.id]["el"]["square2"].w.anim().from(0).to(square_side_px-20).dur(1000).start();
        faces[faceframe.id]["el"]["square2"].h.anim().from(0).to(square_side_px-20).dur(1000).start();


        setTimeout(function(faceframe){
                    faces[faceframe.id]["movement"]["square_status"] = "visible";
                },2500, faceframe);



    } else if (faces[faceframe.id]["movement"]["status"]=="moving" &&  faces[faceframe.id]["movement"]["square_status"] == "visible"){

        faces[faceframe.id]["movement"]["square_status"] = "animating";
                setTimeout(function(faceframe){
                    faces[faceframe.id]["movement"]["square_status"] = "hidden";
                },2000, faceframe);

        faces[faceframe.id]["el"]["square"].x.anim().from(coords_x_rect-square_side_px/2).to(coords_x_rect).delay(600).dur(1000).start();
        faces[faceframe.id]["el"]["square"].y.anim().from(coords_y_rect-square_side_px/2).to(coords_y_rect).delay(600).dur(1000).start();
        faces[faceframe.id]["el"]["square"].w.anim().from(square_side_px).to(0).delay(600).dur(1000).start();
        faces[faceframe.id]["el"]["square"].h.anim().from(square_side_px).to(0).delay(600).dur(1000).start();
    
        faces[faceframe.id]["el"]["square2"].x.anim().from(coords_x_rect-square_side_px/2).to(coords_x_rect+10).delay(600).dur(1000).start();
        faces[faceframe.id]["el"]["square2"].y.anim().from(coords_y_rect-square_side_px/2).to(coords_y_rect+10).delay(600).dur(1000).start();
        faces[faceframe.id]["el"]["square2"].w.anim().from(square_side_px).to(0).delay(600).dur(1000).start();
        faces[faceframe.id]["el"]["square2"].h.anim().from(square_side_px).to(0).delay(600).dur(1000).start();

        // faces[faceframe.id]["el"]["square"].opacity.anim().from(1).to(0).dur(400).start();
    

    } 

    // faces[faceframe.id]["square"]["previous_pos"] = [coords_x_rect,coords_y_rect];
    // console.log("MOVE square / FACE_ID:" + faceframe.id + " geometry:" + faces[faceframe.id]["square"]["previous_pos"] );


}

/////////////////////////////


function draw_realtime_square(faceframe){


    var square_side_px = 200;

    var coords_x_rect = fm.mm2px_x(faceframe.supermiddle[0]) - square_side_px/2;
    var coords_y_rect = fm.mm2px_y(faceframe.supermiddle[1]-20) - square_side_px/2;

   
    if(typeof faces[faceframe.id]["el"]["square"] === "undefined"){

        faces[faceframe.id]["el"]["square"] = gfx.createRect().x(coords_x_rect).y(coords_y_rect).w(square_side_px).h(square_side_px).fill("#FFFFFF").opacity(1.0);
        faces[faceframe.id]["el"]["square2"] = gfx.createRect().x(coords_x_rect+10).y(coords_y_rect+10).w(square_side_px-20).h(square_side_px-20).fill("#000000").opacity(1.0);
        root_group.add(faces[faceframe.id]["el"]["square"]);
        root_group.add(faces[faceframe.id]["el"]["square2"]);
        console.log("NEW square / FACE_ID:" + faceframe.id);

        // faces[faceframe.id]["el"]["square"].w.anim().from(10).to(square_side_px).dur(1000).start();
        // faces[faceframe.id]["el"]["square"].h.anim().from(10).to(square_side_px).dur(1000).delay(1000).start();

        faces[faceframe.id]["square"] = {"previous_pos":[coords_x_rect,coords_y_rect]};

    } 

    faces[faceframe.id]["el"]["square"].x.anim().from(faces[faceframe.id]["square"]["previous_pos"][0]).to(coords_x_rect).dur(200).start();
    faces[faceframe.id]["el"]["square"].y.anim().from(faces[faceframe.id]["square"]["previous_pos"][1]).to(coords_y_rect).dur(200).start();
 
     faces[faceframe.id]["el"]["square2"].x.anim().from(faces[faceframe.id]["square"]["previous_pos"][0]+10).to(coords_x_rect+10).dur(200).start();
    faces[faceframe.id]["el"]["square2"].y.anim().from(faces[faceframe.id]["square"]["previous_pos"][1]+10).to(coords_y_rect+10).dur(200).start();
           
    faces[faceframe.id]["square"]["previous_pos"] = [coords_x_rect,coords_y_rect];
    console.log("MOVE square / FACE_ID:" + faceframe.id + " geometry:" + faces[faceframe.id]["square"]["previous_pos"] );


}

//////////////////////////////////////////

//////////////////////////////////////////



function draw_z_text(faceframe){

      
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
////////////////////////////////////////////////////////////////

function draw_text(faceframe){

      
    var map = faceframe.landmarks_global_mm;
    var coords_x = fm.mm2px_x(faceframe.supermiddle[0])-200;
    var coords_y = fm.mm2px_y(faceframe.supermiddle[1])-50;

    if(typeof faces[faceframe.id]["el"]["text"] === "undefined"){

        faces[faceframe.id]["el"]["text"] = gfx.createText().x(coords_x).y(coords_y).fontSize(20).fontName('ISOCTEUR').text("face_id: " + faceframe.face_id).fontWeight(200);
        root_group.add(faces[faceframe.id]["el"]["text"]);
        console.log("NEW text / FACE_ID:" + faceframe.id);

    } 
  

    var text_str = faces[faceframe.id]["movement"]["status"];

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

    var coords_x = fm.mm2px_x(0);


    var cover_box_width = fm.mm2px_x(4000) - fm.mm2px_x(0);

    stripes1 = gfx.createImageView().opacity(1.0).w(1920).h(1000).x(0).y(0).src("triibustik1000.png");
    stripes2 = gfx.createImageView().opacity(1.0).w(1920).h(1000).x(0).y(1000).src("triibustik1000.png");
    stripes3 = gfx.createImageView().opacity(1.0).w(1920).h(1000).x(0).y(2000).src("triibustik1000.png");


    stripes  = gfx.createGroup();
    stripes.add(stripes1);
    stripes.add(stripes2);
    stripes.add(stripes3);
    
    stripes_coverbox = gfx.createRect().x(coords_x).y(0).opacity(1.0).w(cover_box_width).h(1080).fill("#000000");


    root_group.add(stripes);
    root_group.add(stripes_coverbox);

}

function move_stripes(){

   if(params["stripes"]=="off"){

   	// draw off screen
		stripes.y(4000);

   } else {

	    if (stripes.y.value < -1000){
	      stripes.y(0);
	    } else {
	      stripes.y(stripes.y.value-0.2);
	    }

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
