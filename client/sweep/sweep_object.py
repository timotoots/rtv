import json
import math
import numpy as np
from scipy import ndimage
from scipy import signal

import paho.mqtt.client as paho
import paho.mqtt.subscribe as subscribe

broker = "192.168.22.20"
port = 1883
client1 = paho.Client("rtv2_objects")

# Create function for callback
def on_publish(client,userdata,result):
    print("Objects published ...")

def process_objects(client, userdata, message):
    global client1
    X_SHIFT = 100
    Z_SHIFT = 50
    
    data_samples = json.loads(message.payload)
    xz_plane = np.zeros(shape=(700, 1000))
    for point in data_samples:
        x = point[0] + X_SHIFT
        z = point[1] + Z_SHIFT
        if 0 <= x < 1000 and 0 <= z < 700:
            xz_plane[z][x] += 100
            
    # TODO: fix these values
    xz_plane = ndimage.grey_dilation(xz_plane, size=(20, 20))
    xz_plane = ndimage.grey_erosion(xz_plane, size=(10, 10))
    xz_plane = ndimage.grey_dilation(xz_plane, size=(50, 50))
    
    s = np.ones(shape=(3, 3))
    all_labels = ndimage.measurements.label(xz_plane, structure=s)
    label_list = np.unique(all_labels[0])
    
    inv_detections = ndimage.measurements.center_of_mass(xz_plane, all_labels[0], label_list[1:])
    detections = [[int(x[1])-X_SHIFT, int(x[0])-Z_SHIFT] for x in inv_detections]

    ret = client1.publish("sweep/scan_objects", str(detections))
    # client.disconnect()

def main():
    global client1
    print('-> Starting object script ...')
    client1.on_publish = on_publish
    client1.connect(broker, port)
    subscribe.callback(process_objects, "sweep/scan_xz", hostname="192.168.22.20")
    print('-> Done ...')
    
if __name__ == '__main__':
    main()

