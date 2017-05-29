'use strict';

var client_id = "rtv2";

var path = require('path');
var amino = require('./aminogfx-gl/main.js');

var gfx = new amino.AminoGfx();

// elements and their metadata
var all_rect = [];
var all_rect_pos = [];
var all_poly = [];
var all_depth = [];

var root_group;

var depth_i = 0;

// MQTT CONNECT
const mqtt = require('mqtt')  
const client = mqtt.connect('mqtt://192.168.22.20')

client.on('connect', () => {  
  client.subscribe(client_id + '/#');
  client.subscribe('sweep/#');

})



client.on('message', (topic, message) => {  

    var topics = topic.split("/");
    var el_id = topics[2];

    if(topics[1] === 'square' && el_id) {

        if (typeof all_rect[el_id] === "undefined") {

            // create element
            console.log("NEW square / ID:" + el_id);
            all_rect[el_id] = gfx.createRect().x(-1000).y(-1000).w(200).h(200).fill('#FFFFFF').opacity(1.0);
            root_group.add(all_rect[el_id]);
            all_rect_pos[el_id] = [-1000,-1000];

        }

        var msg = message.toString();
        var coords = msg.split(",");

        all_rect[el_id].x.anim().from(all_rect_pos[el_id][0]).to(coords[0]).dur(10).start();
        all_rect[el_id].y.anim().from(all_rect_pos[el_id][1]).to(coords[1]).dur(10).start();

        all_rect_pos[el_id] = coords;


        console.log("MOVE square ID " + el_id + coords);


    } else if(topics[1] === 'poly' && el_id) {
 

        if (typeof all_poly[el_id] === "undefined") {

            // create element
            console.log("NEW poly / ID:" + el_id);

             all_poly[el_id] = gfx.createPolygon();
             all_poly[el_id].fill("#FFFFFF");
             root_group.add(all_poly[el_id]);
             all_rect_pos[el_id] = [-1000,-1000,-1000,-1000];

        }

        var msg = message.toString();
        var coords = msg.split(",");

        all_poly[el_id].geometry(coords);

        console.log("MOVE poly ID " + el_id + coords);

    } else {

       console.log("Unknown topic: " + topic);


    }


})

function mm2px_x(value_mm){

    // substract screen offset from point zero
    value_mm = value_mm - 1402;

    // screen size 1216 x 682 mm = 1920x1080px 
    return value_mm * 1.5789473684;  


}

function mm2px_y(value_mm){

    // screen size 1216 x 682 mm = 1920x1080px 
    return value_mm * 1.5789473684;  

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
