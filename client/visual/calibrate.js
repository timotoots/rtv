
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

