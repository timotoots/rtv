#!/bin/bash

# Startup script for RTV client

#while true; do

     sleep 10
     /opt/rtv/client/video_server.py &
     # sleep 20
     # su pi -c "node /opt/rtv/client/visual/draw.js" &
     python3 /opt/rtv/client/main.py &

#if [ "$HOSTNAME" = "rtv2" ]; then
#    /opt/rtv/client/sweep_xz.py &
#fi


#done
