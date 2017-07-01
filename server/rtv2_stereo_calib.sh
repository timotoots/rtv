#!/bin/bash

python face_server_stereo.py --calibration_file calibration_stereo_rtv2.npz --camera_x 2009 --camera_y 115 --camera_z -10 --camera_anglex 15 --camera_angley 0.5 --camera_anglez 0 --tv_left 1388 --tv_right 2632 --mqtt_name rtv2_server --left_video_url 'http://rtv2b.local:5000/?width=640&height=480&framerate=40&drc=high&hflip=&nopreview=' --right_video_url 'http://rtv2.local:5000/?width=640&height=480&framerate=40&drc=high&hflip=&nopreview=' $*
