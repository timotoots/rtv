#!/usr/bin/env python3

import paho.mqtt.client as paho
import time
import subprocess
import socket

broker = "192.168.22.20"
port = 1883
client_id = socket.gethostname()
client_id = client_id + "_main"
print(client_id)

def on_message(client1, userdata, message):
    print("message received  "  ,str(message.payload.decode("utf-8")))
    msg = message.payload.decode("utf-8")
    print(message.topic)

    try:

        if message.topic == "rtv_all/control":

            if msg == "uptime":

                output = subprocess.Popen(["uptime"], stdout=subprocess.PIPE).communicate()[0]
                output = output.decode("utf-8")
                print (output)
                client1.publish(client_id + "/control_log/"+msg,output)

            if msg == "rpi_info":

                output = subprocess.Popen(["/opt/rtv/client/rpi_info.sh"], cwd=r'/opt/rtv/', stdout=subprocess.PIPE).communicate()[0]
                output = output.decode("utf-8")
                print (output)
                client1.publish(client_id + "/control_log/"+msg,output)

            if msg == "top":

                output = subprocess.Popen(["top","-n","1","-d","5","-b"], stdout=subprocess.PIPE).communicate()[0]
                output = output.decode("utf-8")
                print (output)
                client1.publish(client_id + "/control_log/"+msg,output)


            if msg == "reboot":

                output = subprocess.Popen(["reboot"], stdout=subprocess.PIPE).communicate()[0]
                output = output.decode("utf-8")
                print (output)
                client1.publish(client_id + "/control_log/"+msg,output)

            if msg == "shutdown":

                    output = subprocess.Popen(["shutdown","now"], stdout=subprocess.PIPE).communicate()[0]
                    output = output.decode("utf-8")
                    print (output)
                    client1.publish(client_id + "/control_log/"+msg,output)

            if msg == "git_status":


                output = subprocess.Popen(["git","status"],  cwd=r'/opt/rtv/', stdout=subprocess.PIPE).communicate()[0]
                output = output.decode("utf-8")
                print (output)
                client1.publish(client_id + "/control_log/"+msg,output)

            if msg == "git_diff":

                output = subprocess.Popen(["git","diff"],  cwd=r'/opt/rtv/', stdout=subprocess.PIPE).communicate()[0]
                output = output.decode("utf-8")
                print (output)
                client1.publish(client_id + "/control_log/"+msg,output)


            if msg == "git_pull":


                output = subprocess.Popen(["git","pull"],  cwd=r'/opt/rtv/', stdout=subprocess.PIPE).communicate()[0]
                output = output.decode("utf-8")
                print (output)
                client1.publish(client_id + "/control_log/"+msg,output)

            if msg == "app_reboot":

                output = subprocess.Popen(["killall","node"], stdout=subprocess.PIPE).communicate()[0]
                output = output.decode("utf-8")
                print (output)
                client1.publish(client_id + "/control_log/"+msg,output)

                subprocess.Popen(["node","/opt/rtv/client/visual/realitytv.js","&"], cwd=r'/opt/rtv/client/visual/',)
                client1.publish(client_id + "/control_log/"+msg,"draw started")

            if msg == "app_kill":

                output = subprocess.Popen(["killall","node"], stdout=subprocess.PIPE).communicate()[0]
                output = output.decode("utf-8")
                print (output)
                client1.publish(client_id + "/control_log/"+msg,output)

    except:
        pass

        # if msg == "sweep reboot":



        # if msg == "camera reboot":    



def on_publish(client,userdata,result):             #create function for callback
    print("data published \n")
    pass



def on_connect(client, userdata, flags, rc):
    m="Connected flags"+str(flags)+"result code "\
    +str(rc)+"client1_id  "+str(client)
    print(m)
    client1.publish(client_id + "/control_log/status","main.py started")

 

def on_disconnect(client, userdata, rc):
    if rc != 0:
        print ("Unexpected MQTT disconnection. Will auto-reconnect")


client1 = paho.Client(client_id + "_control", 0)                           #create client object
client1.on_connect = on_connect        #attach function to callback
client1.on_message = on_message        #attach function to callback
client1.on_disconnect = on_disconnect
time.sleep(1)

client1.connect(broker,port)      
client1.subscribe("rtv_all/control")
                           #establish connection
client1.loop_forever()    #start the loop
# client1.publish("house/bulbs/bulb1","OFF")

