#!/bin/bash

python display_pose2.py --camera_x 3330 --camera_angley -2.7 --tv_left 2632 --tv_right 4020 --mqtt_name rtv3_server --face_id_base 20 --video_url 'http://192.168.22.23:5000/?width=640&height=480&framerate=40&drc=high&colfx=128%3A128&nopreview=' $*
