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

var anim_status = {"stripes":0};
    
var lidar_slots = {};
var lidar_slots_width_mm = 100;

var stripes_coverbox;
var persons_side = "L";

var reality = {"lidar_persons":0,"stripes_fading":0};

var params = {
    "square_color":"#FFFFFF",
    "lidar_color":"#FF0000",
    "stripes":"on",
    "draw_dotface":"off",
    "draw_reddot":"on",
    "draw_lidar":"on",
    "draw_text":"off",
    "draw_striped_square":"off",
    "draw_square_realtime":"off",
    "draw_square":"on",
    "square_side_px": 200

};

var time_started = new Date();
var last_action_time = time_started.getTime();

//////////////////
// Facemirror Module

var Facemirror = require('./facemirror.js');
var fm = new Facemirror({"client_id":client_id,"env":"node"});
fm.foo();


////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

// AMINO GFX

gfx.start(function (err) {

    if (err) {
        console.log('Amino start failed: ' + err.message);
        return;
    }

    root_group = this.createGroup();
    this.setRoot(root_group);
  
    boot(); // start animations

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

// MQTT Connect and input and data analyzis


const mqtt = require('mqtt')  
const client = mqtt.connect('mqtt://192.168.22.20')

client.on('connect', () => {  

  client.subscribe(client_id + '/#');
  client.subscribe('rtv_all/#');
  client.subscribe('sweep/#');

})

client.on('message', (topic, message) => {  

    var topics = topic.split("/");
    var el_id = topics[2];

///////////////////////////////////////////////////////////////////

    if(topics[1] === 'calibrate') {
 
        calibrate();

///////////////////////////////////////////////////////////////////

    } else if (topic === 'sweep/scan_xz'){


        var msg = message.toString();
        var map = JSON.parse(msg);

        // Clean history
        if (sweep_history.length > 2){
            sweep_history.pop();
        }
        var new_map = [];

        var sideL = 0;
        var sideR = 0;

        for (var i = 0; i < map.length; i++) {

            if (map[i][1] > 100 && map[i][1] < 5000 && map[i][0] > 0 && map[i][0] < 4000 && map[i][4]>40){
                

                if(map[i][0]<2000){
                    sideL++;
                } else {
                    sideR++;
                }
                if (sideL > 4 || sideR > 4){

                    if (sideL > sideR ){
                        action_happened("L");
                    } else {
                        action_happened("R");
                    }


                }


                new_map.unshift(map[i]);
            }
        }

        // Add frame to history
        sweep_history.unshift(new_map); // The unshift() method adds new items to the beginning of an array, and returns the new length.

        // Calulate averages in lidar bar slots

        for (var i = 0; i < 4000; i = i + lidar_slots_width_mm) {
            lidar_slots[i].z_average = 0;
        }


        var z_points = {};

        for (var j = 0; j < sweep_history.length; j++) {

            for (var i = 0; i < sweep_history[j].length; i++) {

                var lidar_slot_id = Math.round(sweep_history[j][i][0] / lidar_slots_width_mm) * lidar_slots_width_mm;

                if (typeof lidar_slots[lidar_slot_id] != "undefined"){

                    if (typeof z_points[lidar_slot_id] === "undefined"){
                        z_points[lidar_slot_id] = [];
                    }

                    z_points[lidar_slot_id].unshift(sweep_history[j][i][1]);
                } 
            }

        }

        // add average to lidar_slots
        Object.keys(z_points).forEach(function(key) {
            lidar_slots[key].z_average = arr.median(z_points[key]);
            // console.log("lidar point x=" + key + " z=" + lidar_slots[key].z_average );
        });


    } else if(topics[1] === 'params' && el_id){

        if (typeof params[el_id] != undefined){
            params[id] = message.toString();
        }

    } else if(topics[1] === 'face_new' && el_id) {

        var msg = message.toString();
        var faceframe = JSON.parse(msg);

        // calculate supermiddle
        faceframe = fm.process_faceframe(faceframe);

        if(faceframe != false){

            // Init face and save to history
            faces = fm.check_history(faceframe, faces);

            // Check face movement  
            faces = fm.check_move(faceframe, faces);

            // Check hiding timer
            // check_hide(faceframe);

            // Animations to do
            on_new_faceframe(faceframe);
        }

    } 


})


////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

// CALIBRATION


var calibrate_mode = 0;

function calibrate(){

    calibrate_mode = 1;

    if (typeof calibration_elements[0] === "undefined") {

        // create element
        calibration_elements[0] = gfx.createPolygon();
        calibration_elements[0].fill("#FFFFFF");
        root_group.add(calibration_elements[0]);

        // copypaste from facemirror module
        var px_calib_x1 = 100;
        var px_calib_x2 = 1800;
        var px_calib_y1 = 100;
        var px_calib_y2 = 1000;

        var calib_coords = [px_calib_x1, px_calib_y1, px_calib_x2, px_calib_y1, px_calib_x2, px_calib_y2, px_calib_x1, px_calib_y2];

        calibration_elements[0].geometry(calib_coords);

        // calibrate image
        calibration_elements[1] = gfx.createImageView().opacity(1.0).x(640).y(20).w(640).h(480);
        root_group.add(calibration_elements[1]);

        console.log("CALIBRATE MODE ON");

    }

    // load image from server
    // calibration_elements[1].src("http://rtv0.local:8000/"+ client_id +"/frame.jpg?rand=" + Math.random() );
    // calibration_elements[1].src("http://192.168.22.100/rtv/img/loading_f1.png?rand=" + Math.random() );

    // loop
    if( calibrate_mode == 1 ){

        setTimeout(function(){
            calibrate();
        },200);

    }

}


////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

// Animation control

function boot(){

      // onload
    draw_crosshairs();
    main_loop();
    
    if (params["draw_lidar"]=="on"){
        lidar_slots_init();
        // lidar_slots_loop();
    }
  
    
    // stripes_loop();
    // draw_calibrate_img();
    init_stripes2();
    // stripes_showhide("on","L");

}


function on_new_faceframe(faceframe){

    if(faceframe.supermiddle[0]<2000){
        var side = "L";
    } else {
        var side = "R";
    }
    action_happened(side);

    draw_realtime_square(faceframe);
    //  draw_striped_square(faceframe);

    if(params["draw_text"]=="on"){
        draw_text(faceframe);
    }

    if(params["draw_dotface"]=="on"){
        draw_dotface(faceframe);
    }

  if(params["draw_reddot"]=="on"){
        draw_reddot(faceframe);
    }


    /*

    if(faces[faceframe.id]["movement"]["status"] == "still" && faces[faceframe.id]["movement"]["still_timer"] == "stopped"){


    faces[faceframe.id]["movement"]["still_timer"] = "started";

    // crosshairs_to_face(faceframe);

    setTimeout(function(faceframe){ faces[faceframe.id]["movement"]["still_timer"] = "stopped"; },1000,faceframe);


    }
    */


}



function action_happened(side){

    var d = new Date();
    var action_now = d.getTime();
    if(action_now - last_action_time > 5000){
        stripes_showhide2(side);
        console.log("action!");
    }
    last_action_time = action_now;
}

function check_sleep(){




}



////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////


function main_loop(){

    // check to be forgotten faces

    var d = new Date();
    d = d.getTime();

    for (var i = 0; i < faces.length; i++) {


        if (d - faces[i]["history"][0]["time"] > 3000 && faces[i]["status"]=="active"){

            faces[i]["status"] = "hidden";
            console.log(faces[i]["status"]);
            // square_showhide("off", faces[i]["history"][0]);
            hide_square( faces[i]["history"][0]);

        }

    }

    // loop over all faces
    for (var i = 0; i < faces.length; i++) {
        
        if(params["draw_striped_square"]=="on"){

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





////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

// LIDAR ANIMATIONS

function lidar_slots_init(){

    var bar_width_px = fm.mm2px_x(1000+lidar_slots_width_mm*2) - fm.mm2px_x(1000+lidar_slots_width_mm);

    for (var i = 0; i < 4000; i = i + lidar_slots_width_mm) {
        
        lidar_slots[i] = {};
        var coords_x = fm.mm2px_x(i);
        lidar_slots[i].el = gfx.createRect().x(coords_x-bar_width_px/2).w(bar_width_px).y(2000).h(10).fill(params["lidar_color"]).opacity(1.0);
        root_group.add(lidar_slots[i].el);

    }
    

}

//////////////////////////////////////////////////////////

function lidar_slots_loop(){


    var person_seen = 0;

    for (var i = 0; i < 4000; i = i + lidar_slots_width_mm) {


        if (lidar_slots[i].z_average != 0) {

            var opacity = lidar_slots[i].z_average/3500;
            opacity = 1;
            lidar_slots[i].el.opacity(opacity);
            person_seen = 1;

        } else {

            lidar_slots[i].el.opacity(0);
     
        }

        if( params["draw_lidar"] == "on"){
        	lidar_slots[i].el.y(1032);
        } else {
        	lidar_slots[i].el.y(2000);
        }        
     


    }
    
    
 setTimeout(function(){
        lidar_slots_loop();
    },10);

}


//////////////////////////////////////////////////////////
// Get lidar Z distance by X coordinate

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


////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

// STRIPES ANIMATION


function init_stripes2(){

    var coords_x = fm.mm2px_x(0);

    var cover_box_width = fm.mm2px_x(4000) - fm.mm2px_x(0);

    stripes1 = gfx.createImageView().opacity(1.0).w(1920).h(1000).x(0).y(0).src("triibustik1000.png");
    stripes2 = gfx.createImageView().opacity(1.0).w(1920).h(1000).x(0).y(1000).src("triibustik1000.png");
    stripes3 = gfx.createImageView().opacity(1.0).w(1920).h(1000).x(0).y(2000).src("triibustik1000.png");

    stripes = gfx.createGroup().x(-200).y(0).w(100).h(1080).clipRect(true);

    stripes.add(stripes1);
    stripes.add(stripes2);
    stripes.add(stripes3);
    
    root_group.add(stripes);

}

function init_stripes(){

    var coords_x = fm.mm2px_x(0);

    var cover_box_width = fm.mm2px_x(4000) - fm.mm2px_x(0);

    stripes1 = gfx.createImageView().opacity(1.0).w(1920).h(1000).x(0).y(0).src("triibustik1000.png");
    stripes2 = gfx.createImageView().opacity(1.0).w(1920).h(1000).x(0).y(1000).src("triibustik1000.png");
    stripes3 = gfx.createImageView().opacity(1.0).w(1920).h(1000).x(0).y(2000).src("triibustik1000.png");

    stripes = gfx.createGroup();
    stripes.add(stripes1);
    stripes.add(stripes2);
    stripes.add(stripes3);
    
    stripes_coverbox = gfx.createRect().x(coords_x).y(0).opacity(1.0).w(cover_box_width).h(1080).fill("#000000");

    root_group.add(stripes);
    root_group.add(stripes_coverbox);

}

///////////////////////////////////


function stripes_loop(){

    move_stripes();

    setTimeout(function(){
        stripes_loop();
    },10);


} // function main_loop()

///////////////////////////////////

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


///////////////////////////////////

// animate stripes off - coverbox fade in


function stripes_showhide(onoff, side){


    // if no animation is triggered
    if (anim_status["stripes"]!=1){


            if(side == "L"){
                var pos1 = fm.mm2px_x(0);
                var pos2 = fm.mm2px_x(4000);
            } else {
                var pos1 = fm.mm2px_x(0);
                var pos2 = fm.mm2px_x(-4000);
            }


            if (onoff == "on"){
                var current_pos = pos1
                var to_pos = pos2;
            } else if (onoff == "off") {
                var current_pos = pos2;
                var to_pos = pos1;
            }

            anim_status["stripes"] = 1;
         
            stripes.x.anim().from(current_pos).to(to_pos).dur(2000).start();

            // stripes_coverbox.x.anim().from(current_pos).to(to_pos).dur(2000).start();
            // stripes_coverbox.opacity.anim().from(1).to(0).delay(2000).dur(1).start();


            setTimeout(function(onoff){
                anim_status["stripes"] = 0;
                if (onoff=="on"){
                    if (side=="L"){ side = "R"; } else { side = "L"; }
                    // stripes_showhide("off", side);
                }
            
            },2200, onoff);


        //opacity
        // } else if (onoff == "off"){

        //     anim_status["stripes"] = 1;
        //     var to_pos = fm.mm2px_x(0);

        //     console.log("off");
        //     stripes_coverbox.x(to_pos);
        //     stripes_coverbox.opacity.anim().from(0).to(1).delay(100).dur(2000).start();

        //     setTimeout(function(){
        //         anim_status["stripes"] = 0;
        //     },2200);

        // }

    } // if anim_status["stripes"]==0)


}


function stripes_showhide2(side){


    // if no animation is triggered
    if (anim_status["stripes"]!=1){


            if(side == "L"){
                var pos1 = fm.mm2px_x(-200);
                var pos2 = fm.mm2px_x(4000);
            } else {
                var pos1 = fm.mm2px_x(4000);
                var pos2 = fm.mm2px_x(-200);
            }

            anim_status["stripes"] = 1;
         
            stripes.x.anim().from(pos1).to(pos2).dur(2000).start();

    
            setTimeout(function(){
                anim_status["stripes"] = 0;            
            },2200);

    } // if anim_status["stripes"]==0)


}

///////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////


// ANIMATED SQUARE


function draw_square(faceframe){

   
    // Create element
    if(typeof faces[faceframe.id]["el"]["square"] === "undefined"){

        faces[faceframe.id]["el"]["square"] = gfx.createRect().x(0).y(0).w(0).h(0).opacity(1);
        root_group.add(faces[faceframe.id]["el"]["square"]);
        console.log("NEW square / FACE_ID:" + faceframe.id);
        faces[faceframe.id]["square"] = {"previous_pos":[coords_x_rect,coords_y_rect]};

    } 

    faces[faceframe.id]["el"]["square"].fill(params["square_color"]);

    // var coords_x_rect = fm.mm2px_x(faceframe.supermiddle[0]);
    // var coords_y_rect = fm.mm2px_y(faceframe.supermiddle[1]-20);
    
    var coords_x_rect = fm.mm2px_x(faces[faceframe.id]["movement"]["still_coords"][0]);
    var coords_y_rect = fm.mm2px_y(faces[faceframe.id]["movement"]["still_coords"][1]-20);

    if (faces[faceframe.id]["movement"]["status"]=="still" && faces[faceframe.id]["movement"]["square_status"] == "hidden" ){

        square_showhide("on", faceframe);

    } else if (faces[faceframe.id]["movement"]["status"]=="moving" &&  faces[faceframe.id]["movement"]["square_status"] == "visible"){

        square_showhide("off", faceframe);

    } else if (faces[faceframe.id]["movement"]["square_status"]=="animating"){

        faces[faceframe.id]["el"]["square"].x.anim().from(faces[faceframe.id]["square"]["previous_pos"][0]).to(coords_x_rect).dur(200).start();
        faces[faceframe.id]["el"]["square"].y.anim().from(faces[faceframe.id]["square"]["previous_pos"][1]).to(coords_y_rect).dur(200).start();
 
    }
            
    faces[faceframe.id]["square"]["previous_pos"] = [coords_x_rect,coords_y_rect];
    // console.log("MOVE square / FACE_ID:" + faceframe.id + " geometry:" + faces[faceframe.id]["square"]["previous_pos"] );


}


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

     if (faces[faceframe.id]["movement"]["square_status"] == "hidden" ){

        show_square(faceframe);

    } 


    faces[faceframe.id]["el"]["square"].x.anim().from(faces[faceframe.id]["square"]["previous_pos"][0]).to(coords_x_rect).dur(200).start();
    faces[faceframe.id]["el"]["square"].y.anim().from(faces[faceframe.id]["square"]["previous_pos"][1]).to(coords_y_rect).dur(200).start();
 
     faces[faceframe.id]["el"]["square2"].x.anim().from(faces[faceframe.id]["square"]["previous_pos"][0]+10).to(coords_x_rect+10).dur(200).start();
    faces[faceframe.id]["el"]["square2"].y.anim().from(faces[faceframe.id]["square"]["previous_pos"][1]+10).to(coords_y_rect+10).dur(200).start();
           
    faces[faceframe.id]["square"]["previous_pos"] = [coords_x_rect,coords_y_rect];
    console.log("MOVE square / FACE_ID:" + faceframe.id + " geometry:" + faces[faceframe.id]["square"]["previous_pos"] );


}





function hide_square(faceframe){
        
        faces[faceframe.id]["status"] = "hidden";
        faces[faceframe.id]["movement"]["square_status"] = "hidden";

    faces[faceframe.id]["el"]["square"].opacity.anim().from(1).to(0).dur(200).start();
    faces[faceframe.id]["el"]["square2"].opacity.anim().from(1).to(0).dur(200).start();

}

function show_square(faceframe){

        faces[faceframe.id]["status"] = "active";
        faces[faceframe.id]["movement"]["square_status"] = "visible";

    faces[faceframe.id]["el"]["square"].opacity.anim().from(0).to(1).dur(200).start();
    faces[faceframe.id]["el"]["square2"].opacity.anim().from(0).to(1).dur(200).start();

}

///////////////////////////////////

function square_showhide(onoff, faceframe){


    if ( faces[faceframe.id]["movement"]["square_status"] != "animating"){

         faces[faceframe.id]["movement"]["square_status"] = "animating";

         var coords_x_rect =  faces[faceframe.id]["el"]["square"].x.value;
         var coords_y_rect =  faces[faceframe.id]["el"]["square"].y.value;

        if(onoff == "on"){

            faces[faceframe.id]["el"]["square"].x(coords_x_rect-params["square_side_px"]/2);
            faces[faceframe.id]["el"]["square"].y(coords_y_rect-params["square_side_px"]/2);

            faces[faceframe.id]["el"]["square"].x.anim().from(coords_x_rect).to(coords_x_rect-params["square_side_px"]/2).dur(1000).start();
            faces[faceframe.id]["el"]["square"].y.anim().from(coords_y_rect).to(coords_y_rect-params["square_side_px"]/2).dur(1000).start();
            faces[faceframe.id]["el"]["square"].w.anim().from(0).to(params["square_side_px"]).dur(1000).start();
            faces[faceframe.id]["el"]["square"].h.anim().from(0).to(params["square_side_px"]).dur(1000).start();

            setTimeout(function(faceframe){
                        faces[faceframe.id]["movement"]["square_status"] = "visible";
                    },2500, faceframe);

        } else if(onoff == "off"){

            faces[faceframe.id]["el"]["square"].x.anim().from(coords_x_rect-params["square_side_px"]/2).to(coords_x_rect).delay(600).dur(1000).start();
            faces[faceframe.id]["el"]["square"].y.anim().from(coords_y_rect-params["square_side_px"]/2).to(coords_y_rect).delay(600).dur(1000).start();
            faces[faceframe.id]["el"]["square"].w.anim().from(params["square_side_px"]).to(0).delay(600).dur(1000).start();
            faces[faceframe.id]["el"]["square"].h.anim().from(params["square_side_px"]).to(0).delay(600).dur(1000).start();


            setTimeout(function(faceframe){
                faces[faceframe.id]["movement"]["square_status"] = "hidden";
            },2000, faceframe);


        } 

    } // if not animating


} // function

///////////////////////////////////

function draw_striped_square(faceframe){

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

///////////////////////////////////

function create_pattern_group(faceframe){


    faces[faceframe.id]["el"]["anim_square_pattern_group"] = gfx.createGroup().x(0).y(0).w(200).h(200).clipRect(true);

    faces[faceframe.id]["el"]["anim_square_pattern"] = gfx.createImageView().opacity(1.0).w(1000).h(1000).x(0).y(0);
    faces[faceframe.id]["el"]["anim_square_pattern"].src("stripes90.png");
    // faces[faceframe.id]["el"]["anim_square_pattern"].right(2).bottom(2).repeat('repeat');
    faces[faceframe.id]["el"]["anim_square_pattern_group"].add(faces[faceframe.id]["el"]["anim_square_pattern"]);

    root_group.add(faces[faceframe.id]["el"]["anim_square_pattern_group"]);


}

///////////////////////////////////

function hide_animated_square(faceframe){

    faces[faceframe.id]["el"]["anim_square_pattern_group"].opacity.anim().from(1).to(0).dur(500).start();
    
}

///////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

// CROSSHAIRS


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

///////////////////////////////////

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

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

// IMAGE DRAWING

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



////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

// DOTFACE


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

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

// TEXT DRAWING

function draw_text(faceframe){
      
    var coords_x = fm.mm2px_x(faceframe.supermiddle[0])-200;
    var coords_y = fm.mm2px_y(faceframe.supermiddle[1])-50;

    if(typeof faces[faceframe.id]["el"]["text"] === "undefined"){

        faces[faceframe.id]["el"]["text"] = gfx.createText().x(coords_x).y(coords_y).fontSize(20).fontName('ISOCTEUR').text("").fontWeight(200);
        root_group.add(faces[faceframe.id]["el"]["text"]);
        console.log("NEW text / FACE_ID:" + faceframe.id);

    }

    // move text
    faces[faceframe.id]["el"]["text"].x(coords_x);
    faces[faceframe.id]["el"]["text"].y(coords_y);
    faces[faceframe.id]["el"]["text"].opacity(1);

    // text content
    var text_str = faces[faceframe.id]["movement"]["status"];
    // var text_str = "lidar=" + current_lidar_z + "mm / opencv=" + current_nose_z + "mm / "+ z_offset.toFixed(4);
    // var text_str = "face_id: " + faceframe.face_id;

    faces[faceframe.id]["el"]["text"].text(text_str);

    console.log("MOVE text / FACE_ID:" + faceframe.id + " geometry:" + coords_x + " y:" + coords_y);


} // if draw_text(faceframe)

///////////////////////////////////

function hide_text(faceframe){

    if(typeof faces[faceframe.id]["el"]["text"] != "undefined"){
        faces[faceframe.id]["el"]["text"].opacity(0);
    }

}


////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

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

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

// The end     
