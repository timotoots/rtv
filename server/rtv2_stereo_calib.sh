#!/bin/bash

python face_server_stereo.py \
--calibration_file calibration_stereo_rtv2.npz \
--camera_x 2018 \
--camera_y 115 \
--camera_z -10 \
--camera_anglex 15.5 \
--camera_angley -3.5 \
--camera_anglez 0 \
--tv_left 1388 \
--tv_right 2632 \
--mqtt_name rtv2_server \
--left_video_url 'http://rtv2b.local:5000/?width=640&height=480&framerate=40drc=high&shutter=9000&sharpness=100&hflip=&nopreview=' \
--right_video_url 'http://rtv2.local:5000/?width=640&height=480&framerate=40drc=high&shutter=9000&sharpness=100&hflip=&nopreview=' \
$*
