#!/bin/bash

# Startup script for RTV server

#while true; do
#     sleep 1000
#done

# sleep till raspberrys are up?

# start face servers
cd /opt/rtv/server
./rtv1.sh --no_display &
./rtv2.sh --no_display &
./rtv3.sh --no_display &

# nearest neighbor server
python nn_server.py &

# start image server
cd faces
python -m SimpleHTTPServer 8000
