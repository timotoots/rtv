#!/bin/bash

# Startup script for RTV server

# wait for Mosquitto server
sleep 20s

# sleep till raspberrys are up?

# start face servers
/opt/rtv/server/start_screen.sh
