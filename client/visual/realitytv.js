'use strict';

var os = require('os');
var client_id = os.hostname();
// var client_id = "rtv1";

var path = require('path');
var amino = require('./aminogfx-gl/main.js');


var gfx = new amino.AminoGfx();

// faces and their metadata
var faces = [];

var root_group;

var stripes;

var sweep_history = [];

var anim_status = {"stripes":0};
    
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
var ping_last_time = time_started.getTime();

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

    if (topic === 'sweep/scan_xz'){


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

// Animation control

function boot(){

      // onload
    main_loop();
    init_stripes2();

}


function on_new_faceframe(faceframe){

    client.publish(client_id + '_log/faceframe', "incoming frame");

    if(faceframe.supermiddle[0]<2000){
        var side = "L";
    } else {
        var side = "R";
    }
    action_happened(side);
    draw_realtime_square(faceframe);

}


function action_happened(side){

    if(side=="L"){
        side = "R";
    } else {
        side = "L";
    }

    var d = new Date();
    var action_now = d.getTime();
    if(action_now - last_action_time > 5000){
        stripes_showhide2(side);
        console.log("ACTION on the "+side);
    }
    last_action_time = action_now;
}



////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////



function main_loop(){

    // check to be forgotten faces

    var d = new Date();
    d = d.getTime();

    if(d - ping_last_time > 1000){

        ping_last_time = d;   
        client.publish(client_id + '_log/ping', "1");

    }

    for (var i = 0; i < faces.length; i++) {


        if (d - faces[i]["history"][0]["time"] > 2000 && faces[i]["status"]=="active"){

            faces[i]["status"] = "hidden";
            hide_square( faces[i]["history"][0]);

        }

    }

    setTimeout(function(){
        main_loop();
    },10);


} // function main_loop()



////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

// STRIPES ANIMATION


function init_stripes2(){

    var pos1 = fm.mm2px_x(-200);
    stripes = gfx.createImageView().opacity(1.0).w(200).h(1000).x(pos1).y(0).src("triibustik200.png");   
    root_group.add(stripes);

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

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////


// ANIMATED SQUARE



function draw_realtime_square(faceframe){


    var square_side_px = 200;

    var coords_x_rect = fm.mm2px_x(faceframe.supermiddle[0]) - square_side_px/2;
    var coords_y_rect = fm.mm2px_y(faceframe.supermiddle[1]-20) - square_side_px/2;

   
    if(typeof faces[faceframe.id]["el"]["square"] === "undefined"){

        faces[faceframe.id]["el"]["square"] = gfx.createRect().x(coords_x_rect).y(coords_y_rect).w(square_side_px).h(square_side_px).fill("#FFFFFF").opacity(1.0);
        faces[faceframe.id]["el"]["square2"] = gfx.createRect().x(coords_x_rect+10).y(coords_y_rect+10).w(square_side_px-20).h(square_side_px-20).fill("#000000").opacity(1.0);
        root_group.add(faces[faceframe.id]["el"]["square"]);
        root_group.add(faces[faceframe.id]["el"]["square2"]);
        console.log("FACE_ID:" + faceframe.id + " NEW");

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
    console.log("FACE_ID:" + faceframe.id + " MOVE to " + Math.round(faces[faceframe.id]["square"]["previous_pos"][0]) + "," + Math.round(faces[faceframe.id]["square"]["previous_pos"][1]) );


}


function hide_square(faceframe){
        
    console.log("FACE_ID:" + faceframe.id + " HIDE");

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
