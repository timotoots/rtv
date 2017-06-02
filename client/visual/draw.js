'use strict';

var os = require('os');
var client_id = os.hostname();
// var client_id = "rtv1";

var path = require('path');
var amino = require('./aminogfx-gl/main.js');

var gfx = new amino.AminoGfx();

// elements and their metadata
var all_rect = [];
var all_rect_pos = [];

var all_img = [];
var all_img_pos = [];



var all_text = [];
var all_text_pos = [];

var all_face = [];
var all_face_pos = [];

var all_poly = [];
var all_depth = [];
var games = {"square":0,"movement":0,"dots":0};


if(client_id=="rtv1"){
    games["square"] = 1;
}
if(client_id=="rtv2"){
    games["movement"] = 1;
}
if(client_id=="rtv3"){
    games["dots"] = 1;
}


var root_group;

var depth_i = 0;

var skip_frames_i= 0;
///////////////////////////////////////////////

// Calibrarion data and functions


    // in pixels on screen
    var  px_calib_x1 = 100;
    var  px_calib_x2 = 1800;
    var  px_calib_y1 = 100;
    var  px_calib_y2 = 1000;

    // in mm from mirror top
    if(client_id=="rtv1"){

        var mm_calib_x1 = 205;
        var mm_calib_x2 = 1320;
        var mm_calib_y1 = 210;
        var mm_calib_y2 = 803;

    } else if(client_id=="rtv2"){

        var mm_calib_x1 = 1447;
        var mm_calib_x2 = 2563;
        var mm_calib_y1 = 210;
        var mm_calib_y2 = 803;

    } else if(client_id=="rtv3"){

        var mm_calib_x1 = 2691;
        var mm_calib_x2 = 3807;
        var mm_calib_y1 = 210;
        var mm_calib_y2 = 803;

    }


    var mm_calib_dist_x = mm_calib_x2 - mm_calib_x1;
    var mm_calib_dist_y = mm_calib_y2 - mm_calib_y1;

    var px_calib_dist_x = px_calib_x2 - px_calib_x1;
    var px_calib_dist_y = px_calib_y2 - px_calib_y1;

    var px_per_mm_x = px_calib_dist_x / mm_calib_dist_x;
    var px_per_mm_y = px_calib_dist_y / mm_calib_dist_y;

    var mm_screen_offset_from_mirror_y = mm_calib_y1 - px_calib_y1 / px_per_mm_y;
    var mm_screen_offset_from_mirror_x = mm_calib_x1 - px_calib_x1 / px_per_mm_x;


function mm2px_x(value_mm){

    return (value_mm - mm_screen_offset_from_mirror_x)  *  px_per_mm_x;      

}

function mm2px_y(value_mm){

    return (value_mm - mm_screen_offset_from_mirror_y)  *  px_per_mm_y;      

}



///////////////////////////////////////////////

// MQTT connect

const mqtt = require('mqtt')  
const client = mqtt.connect('mqtt://192.168.22.20')

client.on('connect', () => {  

  client.subscribe(client_id + '/#');
  client.subscribe('rtv_all/#');

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

    if(topics[1] === 'square' && el_id) {

        if (typeof all_rect[el_id] === "undefined") {

            // create element
            console.log("NEW square / ID:" + el_id);
            all_rect[el_id] = gfx.createRect().x(-1000).y(-1000).w(10).h(10).fill('#FFFFFF').opacity(1.0);
            root_group.add(all_rect[el_id]);
            all_rect_pos[el_id] = [-1000,-1000];

        }

        var msg = message.toString();
        var coords = msg.split(",");

        coords[0] = mm2px_x(coords[0]);
        coords[1] = mm2px_y(coords[1]);

       
        all_rect[el_id].x.anim().from(all_rect_pos[el_id][0]).to(coords[0]).dur(10).start();
        all_rect[el_id].y.anim().from(all_rect_pos[el_id][1]).to(coords[1]).dur(10).start();

        all_rect_pos[el_id] = coords;

        console.log("MOVE square ID " + el_id + " / coords: " + coords);

///////////////////////////////////////////////////////////////////

    } if(topics[1] === 'image' && el_id) {

    	// example message
    	// topic: rtv_all/image/1
    	// msg: 2000,300,http://192.168.22.100/zpromo/images/triibustik.png

        if (typeof all_img[el_id] === "undefined") {

            // create element
            console.log("NEW image / ID:" + el_id);
           
            all_img[el_id] = gfx.createImageView().opacity(1.0).w(200).h(200);
            root_group.add(all_img[el_id]);
            all_img_pos[el_id] = [-1000,-1000];

        }

        var msg = message.toString();
        var coords = msg.split(",");

        coords[0] = mm2px_x(coords[0]);
        coords[1] = mm2px_y(coords[1]);

		all_img[el_id].src(coords[2]);
       
        all_img[el_id].x.anim().from(all_img_pos[el_id][0]).to(coords[0]).dur(1000).start();
        all_img[el_id].y.anim().from(all_img_pos[el_id][1]).to(coords[1]).dur(1000).start();

        all_img_pos[el_id] = coords;

        console.log("MOVE image ID " + el_id + " / coords: " + coords);

///////////////////////////////////////////////////////////////////

    } else if(topics[1] === 'poly' && el_id) {
 

        if (typeof all_poly[el_id] === "undefined") {

            // create element
            console.log("NEW poly / ID:" + el_id);

             all_poly[el_id] = gfx.createPolygon();
             all_poly[el_id].fill("#FFFFFF");
             root_group.add(all_poly[el_id]);
             // all_poly_pos[el_id] = [-1000,-1000,-1000,-1000];

        }

        var msg = message.toString();
        var coords = msg.split(",");

        all_poly[el_id].geometry(coords);

        console.log("MOVE poly ID " + el_id + coords);

        ///////////////////////////////////////////////////////////////////

    } else if(topics[1] === 'calibrate') {
 
        el_id = 100;

        if (typeof all_poly[el_id] === "undefined") {

            // create element
            console.log("NEW poly / ID:" + el_id);

             all_poly[el_id] = gfx.createPolygon();
             all_poly[el_id].fill("#FFFFFF");
             root_group.add(all_poly[el_id]);
             // all_poly_pos[el_id] = [-1000,-1000,-1000,-1000];

        }


        all_poly[el_id].geometry([px_calib_x1, px_calib_y1, px_calib_x2, px_calib_y1, px_calib_x2, px_calib_y2, px_calib_x1, px_calib_y2]);


        console.log("MOVE calibrate ID " + el_id + coords);

///////////////////////////////////////////////////////////////////

    } else if(topics[1] === 'face' && el_id) {


        var msg = message.toString();
        var map = JSON.parse(msg);
        var bar_width = 5;

         if(typeof  all_face[el_id] === "undefined"){

             ////////////////////////
             // register new face

            all_face[el_id] = {"landmarks":[], "hidden":1, "hide_timer":0, "last_landmarks_pos":map, "movement_timer":{"x_history":[],"y_history":[],"game_status":"standby","game_start_time":0}};

            /////////////////////////////////
            // DOTS

            if(games["dots"]==1){


                for (var i = 0; i < map.length; i++) {

                    var coords_x = mm2px_x(map[i][0]);
                    var coords_y = mm2px_y(map[i][1]);
                    all_face[el_id]["landmarks"][i] = gfx.createRect().x(coords_x-bar_width/2).y(coords_y).w(bar_width).h(bar_width).fill('#FFFFFF').opacity(1.0);
                    root_group.add(all_face[el_id]["landmarks"][i]);


                } // for

             } // dots

            var coords_x = mm2px_x(map[3][0]);
            var coords_y = mm2px_y(map[3][1]);
            all_face[el_id]["text"] =  gfx.createText().x(coords_x).y(coords_y).fontSize(40).fontName('ISOCTEUR').text('').fontWeight(200);
            root_group.add(all_face[el_id]["text"]);

            console.log("Register new face:" + el_id);

         } // if undefined


         ////////////////////////
         // draw box
 

            if(games["square"]==1){

            var coords_x_rect = mm2px_x(map[30][0])-100;
            var coords_y_rect = mm2px_y((map[19][1]+map[24][1])/2-50);

            var coords_w_rect = mm2px_x(map[17][0]-map[17][0]);
            var coords_h_rect = mm2px_y(map[17][1]);          

            if(typeof  all_rect[el_id+100] === "undefined"){

                all_rect[el_id+100] = gfx.createRect().x(coords_x_rect).y(coords_y_rect).w(200).h(200).opacity(1.0);
                root_group.add(all_rect[el_id+100]);
                all_rect_pos[el_id+100] = [coords_x_rect,coords_y_rect];

            } 
                if(skip_frames_i>=0){
                    all_rect[el_id+100].x.anim().from(all_rect_pos[el_id+100][0]).to(coords_x_rect).dur(200).start();
                    all_rect[el_id+100].y.anim().from(all_rect_pos[el_id+100][1]).to(coords_y_rect).dur(200).start();
                    skip_frames_i = 0;
                }
              
            skip_frames_i++;
      
            
            all_rect_pos[el_id+100] = [coords_x_rect,coords_y_rect];

        }
         
         ////////////////////////
         // draw dots

         if(games["dots"]==1){

            for (var i = 0; i < map.length; i++) {

                var coords_x = mm2px_x(map[i][0]);
                var coords_y = mm2px_y(map[i][1]);

                var from_x = mm2px_x(all_face[el_id]["last_landmarks_pos"][i][0]);
                var from_y = mm2px_y(all_face[el_id]["last_landmarks_pos"][i][1]);


                // all_face[el_id]["landmarks"][i].x.anim().from( from_x).to(coords_x).dur(100).start();
                // all_face[el_id]["landmarks"][i].y.anim().from( from_y).to(coords_y).dur(100).start();

                all_face[el_id]["landmarks"][i].x(coords_x);
                all_face[el_id]["landmarks"][i].y(coords_y);
                // all_face[el_id]["landmarks"][i].opacity.anim().from(1).to(0).dur(3000).start();


            } // for

            if(all_face[el_id]["hidden"] == 1){
                for (var i = 0; i < map.length; i++) {

                    all_face[el_id]["landmarks"][i].opacity(1);
                }
            }



        } // games dots

            
            if(all_face[el_id]["hidden"] == 1){
    
                 all_face[el_id]["text"].opacity(1);
                 all_face[el_id]["hidden"] = 0;
            }


            clearTimeout(all_face[el_id]["hide_timer"]);

            all_face[el_id]["hide_timer"] = setTimeout(function(el_id){

                if(games["dots"]==1){

                    for (var i = 0; i < map.length; i++) {
                        all_face[el_id]["landmarks"][i].opacity(0);
                     }

                }

                all_face[el_id]["text"].opacity(0);


                all_face[el_id]["hidden"] = 1;
              

            },500,el_id);

     

        //////////////////////////////////////////////////////////////////
        /// Movement game

        if(games["movement"]==1){


            var coords_x = mm2px_x(map[0][0]);
            var coords_y = mm2px_y(map[0][1]);

    	    var movement_samples = 4;
            var movement_tolerance_mm = 70;


            all_face[el_id]["movement_timer"]["x_history"].unshift(coords_x);
            all_face[el_id]["movement_timer"]["y_history"].unshift(coords_y);


            if(all_face[el_id]["movement_timer"]["x_history"].length>movement_samples){

                all_face[el_id]["movement_timer"]["x_history"].pop();
                all_face[el_id]["movement_timer"]["y_history"].pop();

            }
     

            var total_x = 0;
            var total_y = 0;
            
            for (var i = 0; i < all_face[el_id]["movement_timer"]["x_history"].length; i++) {
                
                total_x +=  all_face[el_id]["movement_timer"]["x_history"][i];
                total_y +=  all_face[el_id]["movement_timer"]["y_history"][i];

            }

            var avg_x = total_x / all_face[el_id]["movement_timer"]["x_history"].length;
            var avg_y = total_y / all_face[el_id]["movement_timer"]["y_history"].length;

            if( Math.abs(avg_x - coords_x) > movement_tolerance_mm || Math.abs(avg_y - coords_y) > movement_tolerance_mm){

                all_face[el_id]["movement_timer"]["x_history"] = [];
                all_face[el_id]["movement_timer"]["y_history"] = [];

                if(all_face[el_id]["movement_timer"]["game_status"]=="started"){

                    var d = new Date();
                    var time_result = d.getTime() - all_face[el_id]["movement_timer"]["game_start_time"];
    	      		time_result = Math.round(time_result/100);

                    all_face[el_id]["text"].text("YOU MOVED! " + time_result);
                    all_face[el_id]["text"].fill("#FF0000");

                    all_face[el_id]["movement_timer"]["game_status"] = "show_result";
                    console.log("MOVE!");
                    all_face[el_id]["movement_timer"]["game_start_time"]  = 0;
                    setTimeout(function(el_id){

                   		all_face[el_id]["movement_timer"]["game_status"] = "standby";

                    },5000,el_id);

                }

            } else if(all_face[el_id]["movement_timer"]["x_history"].length >= movement_samples && all_face[el_id]["movement_timer"]["game_status"]=="standby") {

                all_face[el_id]["movement_timer"]["game_status"] = "started";
                console.log("game started!");
                all_face[el_id]["text"].text("DON'T MOVE!");
                    all_face[el_id]["text"].fill("#FFFFFF");

                var d = new Date();
                all_face[el_id]["movement_timer"]["game_start_time"] =  d.getTime();

    			movement_timer(el_id);


            } 

        } // movement

        ////////////////////////////////////////////


            var coords_x = mm2px_x(map[30][0])-200;
            var coords_y = mm2px_y(map[30][1]);

        // move text
        all_face[el_id]["text"].x(coords_x);
        all_face[el_id]["text"].y(coords_y+150);


        // save for next time
        all_face[el_id]["last_landmarks_pos"] = map;





    } else if(topics[1] === 'eyes' && el_id) {


        var msg = message.toString();


         if(typeof all_face[el_id]["text"] != "undefined"){

            all_face[el_id]["text"].text("EYES " + msg);
            console.log("NEW face eyes ID " + el_id + ": " +msg);

         }



    } else if(topics[1] === 'text' && el_id) {


///////////////////////////////////////////////////////////////////

 

        if (typeof all_text[el_id] === "undefined") {

            // create element
            console.log("NEW text / ID:" + el_id);

             all_text[el_id] =  gfx.createText().x(50).y(200).fontSize(80).fontName('ISOCTEUR').fontWeight(200);
             all_text[el_id].fill("#FFFFFF");

             root_group.add(all_text[el_id]);
             all_text_pos[el_id] = [-1000,-1000,-1000,-1000];

        }

        var msg = message.toString();
        var coords = msg.split(",");

        all_text[el_id].x.anim().from(all_text_pos[el_id][0]).to(coords[0]).dur(100).start();
        all_text[el_id].y.anim().from(all_text_pos[el_id][1]).to(coords[1]).dur(100).start();
        all_text[el_id].text(coords[2]);

        all_text_pos[el_id] = coords;


        console.log("MOVE text ID " + el_id + coords);

///////////////////////////////////////////////////////////////////

    } else {

       console.log("Unknown topic: " + topic);


    }


})

function movement_timer(id){

	  if (all_face[id]["movement_timer"]["game_status"]=="started"){
		  
		  var d = new Date();
	      var time_result = d.getTime() - all_face[id]["movement_timer"]["game_start_time"];
	      time_result = Math.round(time_result/100);
	      all_face[id]["text"].text("DON'T MOVE! " + time_result);

	      setTimeout(movement_timer,100,id);

      }

}

///////////////////////////////////////////////

