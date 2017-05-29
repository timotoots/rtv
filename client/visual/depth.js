'use strict';

var client_id = "rtv2";

var path = require('path');
var amino = require('./aminogfx-gl/main.js');

var gfx = new amino.AminoGfx();

// elements and their metadata
var all_depth = [];

var root_group;

var depth_i = 0;

// MQTT CONNECT
const mqtt = require('mqtt')  
const client = mqtt.connect('mqtt://192.168.22.20')

client.on('connect', () => {  

  client.subscribe('sweep/#');

})



client.on('message', (topic, message) => {  

    var topics = topic.split("/");
    var el_id = topics[2];

    if (topic === 'sweep/scan_xz'){

        var msg = message.toString();
        var map = JSON.parse(msg);

        for (var depth_i = 0; depth_i < map.length; depth_i++) {

            var coords_x = mm2px_x(map[depth_i][0]*10);
            var bar_width = map[depth_i][1]/4;

            if(map[depth_i][1] > 20 && map[depth_i][1] < 200){

                 console.log(coords_x);

                if (typeof all_depth[depth_i] === "undefined") {

                console.log("NEW depth / ID:" + depth_i);

                all_depth[depth_i] = gfx.createRect().x(coords_x-bar_width/2).y(0).w(bar_width).h(1080).fill('#FFFFFF').opacity(1.0);
                root_group.add(all_depth[depth_i]);

                } else {

                     all_depth[depth_i].x.anim().from(0).to(coords_x).dur(1).start();
                }

                 all_depth[depth_i].opacity.anim().from(1).to(0).dur(100).start();

            } // if in boundaries


        }



    } else {

       console.log("Unknown topic: " + topic);


    }


})

////////////////////////////////////////////////

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

////////////////////////////////////////////////

// Amino GFX start

gfx.start(function (err) {

    if (err) {
        console.log('Start failed: ' + err.message);
        return;
    }

    root_group = this.createGroup();
    this.setRoot(root_group);

});
