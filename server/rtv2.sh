#!/bin/bash

python face_server.py --camera_x 2015 --camera_anglex 13.5 --camera_angley 1.7 --camera_anglez 1 --tv_left 1388 --tv_right 2632 --mqtt_name rtv2_server --video_url 'http://192.168.22.22:5000/?width=640&height=480&framerate=40&drc=high&nopreview=' $*
