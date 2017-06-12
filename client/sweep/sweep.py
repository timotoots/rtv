import paho.mqtt.client as paho
from sweeppy import Sweep

broker="192.168.22.20"
port=1883

def on_publish(client,userdata,result):             #create function for callback
    print("data published \n")
    pass

client1 = paho.Client("rtv2")                           #create client object
client1.on_publish = on_publish                          #assign function to callback
client1.connect(broker,port)                                 #establish connection


with Sweep('/dev/ttyUSB0') as sweep:
    
    sweep.start_scanning()

    for scan in sweep.get_scans():

       # print('{}\n'.format(scan))

        ret= client1.publish("sweep/scan",str(scan))                   #publish
