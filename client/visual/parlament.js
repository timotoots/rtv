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

///////////////////////////////////////////////

// Calibrarion data and functions


    // in pixels on screen
    var px_calib_x1 = 100;
    var px_calib_x2 = 1800;
    var px_calib_y1 = 100;
    var px_calib_y2 = 1000;

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
  
    // onload
    draw_crosshairs();


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
 
        el_id = 0;

        if (typeof calibration_elements[el_id] === "undefined") {

            // create element
            console.log("NEW poly / ID:" + el_id);

            calibration_elements[el_id] = gfx.createPolygon();
            calibration_elements[el_id].fill("#FFFFFF");
            root_group.add(calibration_elements[el_id]);

        }

        var calib_coords = [px_calib_x1, px_calib_y1, px_calib_x2, px_calib_y1, px_calib_x2, px_calib_y2, px_calib_x1, px_calib_y2];

        calibration_elements[el_id].geometry(calib_coords);

        console.log("CALIBRATE " + calib_coords);

///////////////////////////////////////////////////////////////////


    } else if(topics[1] === 'face_new' && el_id) {

        // parse message
        var msg = message.toString();
        var faceframe = JSON.parse(msg);


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
      

      	// Check face movement  
        check_move(faceframe);

        // Check hiding timer
        check_hide(faceframe);

        // Real time drawings
        // draw_img(faceframe);
        
        // draw_facepoly(faceframe);

        // draw_dotface(faceframe);
    
     	// draw_text(faceframe);

     	// draw_square(faceframe);

            // console.log(faces[faceframe.id]["movement"]["status"]);

        if(faces[faceframe.id]["movement"]["status"] == "still" && faces[faceframe.id]["crosshairs"]["status"] == "grid"){

            // console.log(faces[faceframe.id]["movement"]["status"]);

            faces[faceframe.id]["crosshairs"]["status"] = "anim";

            crosshairs_to_face(faceframe);

            setTimeout(function(faceframe){ faces[faceframe.id]["crosshairs"]["status"] = "grid"; },30000,faceframe);
            

        }


    } 


})


////////////////////////////////////////////////////////////////////////////////

function main_loop(){


	// loop over all faces
	for (var i = 0; i < faces.length; i++) {

		
		// face_dislay(i);


	}


	setTimeout("main_loop",10);


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




//////////////////////////////////////////////////////////////////
//
// ANALYZING FACES


function check_move(faceframe){

    if(typeof faces[faceframe.id]["movement"] === "undefined"){

    	faces[faceframe.id]["movement"] = {"status":"moving"};

    }

    // console.log(faces[faceframe.id]["movement"]);


	// current coordinates of the nose
    var coords_x = mm2px_x(faceframe.nose_global_mm[0]);
    var coords_y = mm2px_y(faceframe.nose_global_mm[1]);
 
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

    var avg_x = mm2px_x(total_x / samples_for_average);
    var avg_y = mm2px_y(total_y / samples_for_average);

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




} // function check_move(faceframe)

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
        crosshairs[crosshair_id].src("http://192.168.22.100/rtv/crosshair.png");

        var coords = [];
        coords[0] = mm2px_x(x*333 + crosshair_offset_x);
        coords[1] = mm2px_y(y*333 + crosshair_offset_y);

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
           
            var from_x = mm2px_x(x * 333 + crosshair_offset_x);
            var from_y = mm2px_y(y * 333 + crosshair_offset_y);


            var coords_x = mm2px_x(faceframe.landmarks_global_mm[i][0]);
            var coords_y = mm2px_y(faceframe.landmarks_global_mm[i][1]);

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
    coords[0] = mm2px_x(faceframe.landmarks_global_mm[0][0]);
    coords[1] = 10;

    faces[faceframe.id]["el"]["image"].x(coords[0]);
    faces[faceframe.id]["el"]["image"].y(coords[1]);

    console.log("MOVE image / FACE_ID:" + faceframe.id + " x:" + coords[0] + " y:" + coords[1] +" " + faceframe.face_image_url);




} // draw img


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
        geometry2.push(mm2px_x(geometry[i][0]));
        geometry2.push(mm2px_y(geometry[i][1]));
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
			var coords_x = mm2px_x(faceframe.landmarks_global_mm[i][0]);
			var coords_y = mm2px_y(faceframe.landmarks_global_mm[i][1]);
			faces[faceframe.id]["el"]["dotface"][i] = gfx.createRect().x(coords_x-box_width/2).y(coords_y).w(box_width).h(box_width).fill('#FFFFFF').opacity(1.0);
			root_group.add(faces[faceframe.id]["el"]["dotface"][i]);
		} // for

        console.log("NEW dotface / FACE_ID:" + faceframe.id);

    }

    // move landmark points to new coordinates
	for (var i = 0; i < faceframe.landmarks_global_mm.length; i++) {

		// current frame
		var coords_x = mm2px_x(faceframe.landmarks_global_mm[i][0]);
		var coords_y = mm2px_y(faceframe.landmarks_global_mm[i][1]);

		// last frame
        if (faces[faceframe.id]["history"].length>1){
            var previous_faceframe = faces[faceframe.id]["history"][1];
        } else {
            var previous_faceframe = faces[faceframe.id]["history"][0];
        }
		var from_x = mm2px_x(previous_faceframe.landmarks_global_mm[i][0]);
		var from_y = mm2px_y(previous_faceframe.landmarks_global_mm[i][1]);

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
	var coords_x_rect = mm2px_x(map[30][0])-100;
	var coords_y_rect = mm2px_y((map[19][1]+map[24][1])/2-50);

	var coords_w_rect = mm2px_x(map[17][0]-map[17][0]);
	var coords_h_rect = mm2px_y(map[17][1]); 

   
    if(typeof faces[faceframe.id]["el"]["square"] === "undefined"){

        faces[faceframe.id]["el"]["square"] = gfx.createRect().x(coords_x_rect).y(coords_y_rect).w(200).h(200).opacity(1.0);
        root_group.add(faces[faceframe.id]["el"]["square"]);
        console.log("NEW square / FACE_ID:" + faceframe.id);

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
    var coords_x = mm2px_x(map[30][0])-200;
    var coords_y = mm2px_y(map[30][1])+150;

    if(typeof faces[faceframe.id]["el"]["text"] === "undefined"){

        faces[faceframe.id]["el"]["text"] = gfx.createText().x(coords_x).y(coords_y).fontSize(40).fontName('ISOCTEUR').text("face_id: " + faceframe.face_id).fontWeight(200);
        root_group.add(faces[faceframe.id]["el"]["text"]);
        console.log("NEW text / FACE_ID:" + faceframe.id);

    } 

    // move text
    faces[faceframe.id]["el"]["text"].x(coords_x);
    faces[faceframe.id]["el"]["text"].y(coords_y);

    console.log("MOVE text / FACE_ID:" + faceframe.id + " geometry:" + coords_x + " y:" + coords_y);


} // if draw_text(faceframe)





           
