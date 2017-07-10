#!/usr/bin/env python3
import math
import time

import paho.mqtt.client as paho
from sweeppy import Sweep

from usb.core import find as finddev


broker="192.168.22.20"
port=1883
flag_connected = 0

# Create function for callback
def on_publish(client,userdata,result):
    print("data published \n")
    pass
 

def on_connect(client, userdata, flags, rc):
    global flag_connected
    flag_connected = 1

    m="Connected flags"+str(flags)+"result code "\
    +str(rc)+"client1_id  "+str(client)
    print(m)
    client1.publish("sweep/status","sweep started")

def on_disconnect(client, userdata, rc):
    global flag_connected
    flag_connected = 0
    if rc != 0:
        print ("Unexpected MQTT disconnection. Will auto-reconnect")







# Establish MQTT connection
client1 = paho.Client("rtv2_sweep")
client1.on_connect = on_connect        #attach function to callback
client1.on_disconnect = on_disconnect
client1.on_publish = on_publish

time.sleep(1)




try:
   client1.connect(broker,port)
except:
   print("problem")
   time.sleep(60)
   try:
     client1.connect(broker,port)
   except:
     pass

client1.loop_start()    #start the loop


reset_counter = 0

with Sweep('/dev/ttyUSB0') as sweep:
    
    if reset_counter>100:
       dev = finddev(idVendor=0x0403, idProduct=0x6015)
       dev.reset()
       reset_counter = 0
   
    reset_counter = reset_counter + 1

    # Set motor speed, 0:10 Hz
    sweep.set_motor_speed(10)
    # Set sample rate, 500, 750 or 1000 Hz
    sweep.set_sample_rate(750)
    
    speed = sweep.get_motor_speed()
    rate = sweep.get_sample_rate()
    print('Motor Speed: {} Hz'.format(speed))
    print('Sample Rate: {} Hz'.format(rate))

    sweep.start_scanning()
    
    # Distance to the center of the mirror [cm]
    x0 = 201
    # Distance to the mirror plane [cm]
    z0 = 5
    # Number os scans before transmit
    n_scans = 8

    acc_count = 0
    samples = []

    for scan in sweep.get_scans():
            
        for s in scan.samples:
            # Angle is in milli degree
            angle = s.angle
            # Distance is in centimeters
            distance = s.distance
            # Strength ...
            signal_strength = s.signal_strength

            # Convert angle from milli to degree
            # rotate -90, limit to 360 degrees
            a = (angle/1000.0 - 90.0) % 360.0
            # Filter data from mirror wall
            if 180 < a < 360:
                continue

            # Calculate cartesian coordinates
            # (x,z) = (0,0) at the lower left corner
            x = int(math.cos(math.radians(a))*distance + x0)
            z = int(math.sin(math.radians(a))*distance - z0)

            # Add samples
            # x = lidar x coordinate in cm
            # z = lidar z coordinate in cm
            # angle = lidar angle in milli degree  
            # distance = lidar distance in cm
            # signal_strength = signal strenght
            samples.append([x*10, z*10, angle, distance, signal_strength])
            
        # Accumulate n_scans times before sending
        acc_count = (acc_count + 1) % n_scans
        


        if acc_count == 0:
            if flag_connected == 1:
                ret = client1.publish("sweep/scan_xz",str(samples))
            else:
                print("not connected")
            samples = []
