#!/bin/bash

# Startup script for RTV server

#while true; do
#     sleep 1000
#done

# sleep till raspberrys are up?

# start face servers
cd /opt/rtv/server
./rtv1_stereo.sh --no_display &
./rtv2_stereo_calib.sh --no_display &
./rtv3_stereo_calib.sh --no_display &

# nearest neighbor server
# to clean up server delete database
#rm -f nn_server.db
python nn_server.py &

# start image server
cd faces
python -m SimpleHTTPServer 8000
