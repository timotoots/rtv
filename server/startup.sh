#!/bin/bash

# Startup script for RTV server

#while true; do
#     sleep 1000
#done

# sleep till raspberrys are up?

cd /opt/rtv/server
./rtv1.sh &
./rtv2.sh &
./rtv3.sh &
