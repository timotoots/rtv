#!/bin/bash

cd /opt/rtv/client/visual/
client_id=$HOSTNAME
client_id+="_debug"
node /opt/rtv/client/visual/realitytv.js | mosquitto_pub -h rtv0.local -t $client_id -l
