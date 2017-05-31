#!/bin/bash

# Startup script for RTV server

#while true; do
     
     python /opt/rtv/client/video_server.py &
     node /opt/rtv/client/visual/draw.js &


if [ "$HOSTNAME" = rtv2 ]; then
    python3 /opt/rtv/client/sweep_xz.py &
fi


#done
