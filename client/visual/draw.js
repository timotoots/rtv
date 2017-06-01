'use strict';

//var client_id = "rtv2";

var os = require('os');
var client_id = os.hostname();

var path = require('path');
var amino = require('./aminogfx-gl/main.js');

var gfx = new amino.AminoGfx();

// elements and their metadata
var all_rect = [];
var all_rect_pos = [];
var all_text = [];
var all_text_pos = [];

var all_face = [];
var all_face_pos = [];


var all_poly = [];
var all_depth = [];

var root_group;

var depth_i = 0;

///////////////////////////////////////////////

    // in pixels on screen
    var  px_calib_x1 = 100;
    var  px_calib_x2 = 1800;
    var  px_calib_y1 = 100;
    var  px_calib_y2 = 1000;

    if(client_id=="rtv1"){

        // in mm from mirror top
        var mm_calib_x1 = 205;
        var mm_calib_x2 = 1320;
        var mm_calib_y1 = 210;
        var mm_calib_y2 = 803;

    } else if(client_id=="rtv2"){

        // in mm from mirror top
        var mm_calib_x1 = 1447;
        var mm_calib_x2 = 2563;
        var mm_calib_y1 = 210;
        var mm_calib_y2 = 803;

    } else if(client_id=="rtv3"){

        // in mm from mirror top
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


///////////////////////////////////////////////

// MQTT CONNECT
const mqtt = require('mqtt')  
const client = mqtt.connect('mqtt://192.168.22.20')

client.on('connect', () => {  
  client.subscribe(client_id + '/#');
  client.subscribe('rtv_all/#');

})


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

        // console.log(coords);

        coords[0] = mm2px_x(coords[0]);
        coords[1] = mm2px_y(coords[1]);

        // coords[0] = parseInt(coords[0]);
        // coords[1] = parseInt(coords[1]);

 
        // all_rect[el_id].w(1843);
        // all_rect[el_id].h(1031);

       
        all_rect[el_id].x.anim().from(all_rect_pos[el_id][0]).to(coords[0]).dur(10).start();
        all_rect[el_id].y.anim().from(all_rect_pos[el_id][1]).to(coords[1]).dur(10).start();

        all_rect_pos[el_id] = coords;

        console.log("MOVE square ID " + el_id + " / coords: " + coords);

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

            all_face[el_id] = {"landmarks":[], "last_landmarks_pos":map};

            for (var i = 0; i < map.length; i++) {

                var coords_x = mm2px_x(map[i][0]);
                var coords_y = mm2px_y(map[i][1]);
                all_face[el_id]["landmarks"][i] = gfx.createRect().x(coords_x-bar_width/2).y(coords_y).w(bar_width).h(bar_width).fill('#FFFFFF').opacity(1.0);
                root_group.add(all_face[el_id]["landmarks"][i]);


            } // for

            var coords_x = mm2px_x(map[28][0]);
            var coords_y = mm2px_y(map[28][1]);
            all_face[el_id]["text"] =  gfx.createText().x(coords_x).y(coords_y).fontSize(40).fontName('ISOCTEUR').text('FACE '+el_id).fontWeight(200);
            root_group.add(all_face[el_id]["text"]);

            console.log("Register new face:" + el_id);

         } // if undefined


         ////////////////////////
         // draw squares

        for (var i = 0; i < map.length; i++) {

            var coords_x = mm2px_x(map[i][0]);
            var coords_y = mm2px_y(map[i][1]);

            var from_x = mm2px_x(all_face[el_id]["last_landmarks_pos"][i][0]);
            var from_y = mm2px_y(all_face[el_id]["last_landmarks_pos"][i][1]);


            // all_face[el_id]["landmarks"][i].x.anim().from( from_x).to(coords_x).dur(100).start();
            // all_face[el_id]["landmarks"][i].y.anim().from( from_y).to(coords_y).dur(100).start();

            all_face[el_id]["landmarks"][i].x(coords_x);
            all_face[el_id]["landmarks"][i].y(coords_y);

        } // for

        var coords_x = mm2px_x(map[28][0]);
        var coords_y = mm2px_y(map[28][1]);


        // move text
        all_face[el_id]["text"].x(coords_x);
        all_face[el_id]["text"].y(coords_y);


        // save for next time
        all_face[el_id]["last_landmarks_pos"] = map;

  

///////////////////////////////////////////////////////////////////

    } else if(topics[1] === 'text' && el_id) {
 

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

function mm2px_x(value_mm){

/*
    // substract screen offset in mm from point zero on glass
    if(client_id=="rtv1"){
       var offset = 161;
    } else  if(client_id=="rtv2"){
       var offset = 1405;
    } else  if(client_id=="rtv3"){
       var offset = 2644;
    }
    value_mm = value_mm - offset;
*/

    return (value_mm - mm_screen_offset_from_mirror_x)  *  px_per_mm_x;      



}

function mm2px_y(value_mm){

    return (value_mm - mm_screen_offset_from_mirror_y)  *  px_per_mm_y;      

}

////////////////////////

gfx.start(function (err) {

    if (err) {
        console.log('Start failed: ' + err.message);
        return;
    }

    root_group = this.createGroup();
    this.setRoot(root_group);

 


  

/*
    //text
    var text = this.createText().fill('#ff0000').opacity(1.0).x(100).y(200);

    text.text('Sample Text');
    text.opacity.anim().from(0.0).to(1.0).dur(1000).loop(-1).start();
    root_group.add(text);

  */

});
