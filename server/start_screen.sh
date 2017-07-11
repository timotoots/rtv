#!/bin/bash

# reboot node js
mosquitto_pub -h localhost -t "rtv_all/control" -m "app_reboot"

screen -dmS rtvserver -c /opt/rtv/server/screenrc
