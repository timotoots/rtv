#!/bin/bash

python face_server.py --camera_x 697 --camera_anglex 14.6 --camera_angley -1.5 --tv_left 0 --tv_right 1338 --mqtt_name rtv1_server --face_id_base 0 --video_url 'http://192.168.22.21:5000/?width=640&height=480&framerate=40&drc=high&colfx=128%3A128&nopreview=' $*
