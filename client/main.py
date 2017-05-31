import paho.mqtt.client as paho
import time
import subprocess
import socket

broker = "192.168.22.20"
port = 1883
client_id = socket.gethostname()

def on_message(client1, userdata, message):
	print("message received  "  ,str(message.payload.decode("utf-8")))
	msg = message.payload.decode("utf-8")
	print(message.topic)

	if message.topic == "rtv_master/control":

		if msg == "test":

			output = subprocess.Popen(["ls", "-la"], stdout=subprocess.PIPE).communicate()[0]
			output = output.decode("utf-8")
			print (output)
			client1.publish(client_id + "/control_log",output)

		if msg == "reboot":

			output = subprocess.Popen(["reboot"], stdout=subprocess.PIPE).communicate()[0]
			output = output.decode("utf-8")
			print (output)
			client1.publish(client_id + "/control_log",output)

		# if msg == "git pull":

		if msg == "app reboot":

			output = subprocess.Popen(["killall","node"], stdout=subprocess.PIPE).communicate()[0]
			output = output.decode("utf-8")
			print (output)
			client1.publish(client_id + "/control_log",output)

			subprocess.Popen(["node","/opt/rtv/client/visual/draw.js","&"])
			client1.publish(client_id + "/control_log","draw started")


		# if msg == "sweep reboot":



		# if msg == "camera reboot":    



def on_publish(client,userdata,result):             #create function for callback
	print("data published \n")
	pass



def on_connect(client, userdata, flags, rc):
	m="Connected flags"+str(flags)+"result code "\
	+str(rc)+"client1_id  "+str(client)
	print(m)

client1 = paho.Client(client_id + "_control")                           #create client object
client1.on_connect = on_connect        #attach function to callback
client1.on_message = on_message        #attach function to callback
time.sleep(1)

client1.connect(broker,port)      
client1.subscribe("rtv_master/control")
						   #establish connection
client1.loop_forever()    #start the loop
# client1.publish("house/bulbs/bulb1","OFF")

