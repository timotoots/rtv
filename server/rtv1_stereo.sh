#!/bin/bash

python face_server_stereo.py --right_camera_shift -80 --camera_x 694 --camera_y 116 --camera_z 10 --camera_anglex 14.8 --camera_angley 0 --camera_anglez 0 --tv_left 0 --tv_right 1338 --mqtt_name rtv1_server --left_video_url 'http://rtv1b.local:5000/?width=640&height=480&framerate=40&drc=high&hflip=&nopreview=' --right_video_url 'http://rtv1.local:5000/?width=640&height=480&framerate=40&drc=high&hflip=&nopreview=' $*
