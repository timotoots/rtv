#!/bin/bash

python face_server_stereo.py --camera_x 703 --camera_y 115 --camera_z -10 --camera_anglex 14.8 --camera_angley -0.1 --camera_anglez 0.5 --tv_left 0 --tv_right 1338 --mqtt_name rtv1_server --left_video_url 'http://rtv1b.local:5000/?width=640&height=480&framerate=40&drc=high&shutter=9000&sharpness=100&hflip=&nopreview=' --right_video_url 'http://rtv1.local:5000/?width=640&height=480&framerate=40&drc=high&shutter=9000&sharpness=100&hflip=&nopreview=' $*
