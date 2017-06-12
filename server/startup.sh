#!/bin/bash

# Startup script for RTV server

#while true; do
#     sleep 1000
#done

# sleep till raspberrys are up?

# start face servers
cd /opt/rtv/server
./rtv1.sh &
./rtv2.sh &
./rtv3.sh &

# start image server
cd faces
python -m SimpleHTTPServer 8000
