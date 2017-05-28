#!/bin/bash

# Startup script for RTV server

#while true; do
     /opt/rtv/client/camera.sh &
     python3 /opt/rtv/client/sweep.py &
#done
