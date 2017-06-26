#!/bin/bash

python face_server.py --camera_x 697 --camera_anglex 13.8 --camera_angley 0 --tv_left 0 --tv_right 1338 --mqtt_name rtv1_server --video_url 'http://192.168.22.21:5000/?width=640&height=480&framerate=40&drc=high&nopreview=' $*
