# Server

* Processes images and controls graphics on clients by MQTT.


# Installation

Install Ubuntu 14.04

	sudo apt-get update
	sudo apt-get install ssh
	sudo apt-get upgrade
	sudo apt-get install mosquitto git 

TODO: install CUDA and cuDNN for dlib

Python dependencies

	# OpenCV
	sudo apt-get install python-opencv
	# dlib dependencies
	sudo apt-get install libboost-python-dev cmake
	# dlib itself
	sudo pip install dlib --install-option="--yes" --install-option="USE_AVX_INSTRUCTIONS"
	# Paho MQTT
	sudo pip install paho-mqtt

Server app

	sudo chown timo:timo /opt/
	cd /opt/
	git clone https://github.com/timotoots/rtv.git

Face recognition models
	
	cd rtv/server
	wget https://github.com/ageitgey/face_recognition_models/raw/master/face_recognition_models/models/shape_predictor_68_face_landmarks.dat
	wget https://github.com/ageitgey/face_recognition_models/raw/master/face_recognition_models/models/dlib_face_recognition_resnet_model_v1.dat

# Start script on boot

sudo nano /etc/rc.local

	add line:
	/opt/rtv/server/startup.sh &
