# Server

* Processes images and controls graphics on clients by MQTT.


# Installation

Install Ubuntu 14.04

	sudo apt-get update
	sudo apt-get install ssh
	sudo apt-get upgrade
	sudo apt-get install mosquitto git 

Python dependencies

	# OpenCV
	sudo apt-get install python-opencv
	# dlib dependencies
	sudo apt-get install build-essential cmake
	sudo apt-get install libgtk-3-dev
	sudo apt-get install libboost-all-dev
	# dlib itself?
	#sudo pip install dlib

TODO: install CUDA and cuDNN for dlib

Compiling dlib

1. Download latest source from https://pypi.python.org/pypi/dlib#downloads and untar it.
2. `bash mkdir build; cd build; cmake .. -DUSE_AVX_INSTRUCTIONS=1; cmake --build . `
3. `bash python setup.py install --yes USE_AVX_INSTRUCTIONS `

Server app

	sudo chown timo:timo /opt/
	cd /opt/
	git clone https://github.com/timotoots/rtv.git

# Start script on boot

sudo nano /etc/rc.local

	add line:
	/opt/rtv/server/startup.sh &
