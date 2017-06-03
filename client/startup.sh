#!/bin/bash

# Startup script for RTV server

#while true; do

     sleep 10
     /opt/rtv/client/video_server.py &
#     node /opt/rtv/client/visual/draw.js &
     /opt/rtv/client/main.py &

if [ "$HOSTNAME" = "rtv2" ]; then
#    /opt/rtv/client/sweep_xz.py &
fi


#done
