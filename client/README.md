# RPi Client

* Takes image from webcam and streams to server.
* Scans room with Sweep Lidar and sends measurements by MQTT.
* Displays graphics controlled by MQTT.


# Installation


# Setup on Raspberry Pi
install Raspbian

# Raspberry Pi config
sudo raspi-config

	set hostname
	set user password
	enable camera
	enable ssh
	boot to console


sudo nano /boot/config.txt

	add line: gpu_mem=180

sudo apt-get update

sudo apt-get upgrade

# Install RTV Git repository

	sudo chown pi:pi /opt/
	cd /opt/
	git clone https://github.com/timotoots/rtv.git


# Install new Node JS

	curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash -
	sudo apt-get install nodejs


# Install AminoGFX library

https://github.com/joshmarinacci/aminogfx-gl  

	sudo apt-get install libjpeg-dev libavformat-dev libswscale-dev libavcodec-dev

	cd /opt/rtv/client
	sudo npm install aminogfx-gl
	node /opt/rtv/client/test.js

# Build and install Sweep SDK
	
https://github.com/scanse/sweep-sdk/blob/master/libsweep/README.md  

	sudo apt-get install cmake

	cd /opt/
	git clone https://github.com/scanse/sweep-sdk.git

# Install Paho MQTT module for Python3

	sudo pip3 install paho-mqtt


# Disable console blanking

sudo nano /etc/kbd/config

	BLANK_TIME=0
	POWERDOWN_TIME=0 

sudo nano /boot/cmdline.txt
	
	set consoleblank=0


# Start script on boot
sudo nano /etc/rc.local

	add line:
	/opt/rtv/client/startup.sh &