#!/bin/bash

python face_server.py --camera_x 3330 --camera_anglex 13.4 --camera_angley -1.7 --camera_anglez 2.0 --tv_left 2632 --tv_right 4020 --mqtt_name rtv3_server --video_url 'http://192.168.22.23:5000/?width=640&height=480&framerate=40&drc=high&nopreview=' $*
