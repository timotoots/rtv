#!/bin/bash

python face_server_stereo.py \
--calibration_file calibration_stereo_rtv3.npz \
--camera_x 3212 \
--camera_y 115 \
--camera_z -10 \
--camera_anglex 16 \
--camera_angley -1 \
--camera_anglez 0 \
--tv_left 2632 \
--tv_right 4020 \
--mqtt_name rtv3_server \
--left_video_url 'http://rtv3b.local:5000/?width=640&height=480&framerate=40&drc=high&shutter=9000&sharpness=100&hflip=&nopreview=' \
--right_video_url 'http://rtv3.local:5000/?width=640&height=480&framerate=40&drc=high&shutter=9000&sharpness=100&hflip=&nopreview=' $*
