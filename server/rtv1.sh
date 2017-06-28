#!/bin/bash

python face_server.py --camera_x 697 --camera_anglex 14.0 --camera_angley 0 --tv_left 0 --tv_right 1338 --mqtt_name rtv1_server --video_url 'http://rtv1.local:5000/?width=640&height=480&framerate=40&drc=high&nopreview=' $*
