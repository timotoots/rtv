# RPi Client

* Takes image from webcam and streams to server.
* Scans room with Sweep Lidar and sends measurements by MQTT.
* Displays graphics controlled by MQTT.

----------------------------------------------------------------------

# Installation

# Setup on Raspberry Pi
install Raspbian Lite

# Raspberry Pi config
sudo raspi-config

	set hostname
	set user password
	enable camera
	enable ssh
	boot to console

# Change timezone

sudo rm /etc/localtime
sudo ln -s /usr/share/zoneinfo/Europe/Tallinn /etc/localtime

# Change keyboard layout

sudo nano /etc/default/keyboard

	change line: 
	XKBLAYOUT="ee"

# Update apt

sudo apt-get update

sudo apt-get upgrade

sudo apt-get install screen

# Install RTV Git repository

	sudo apt-get install git python-flask python3 python3-pip
	sudo pip3 install paho-mqtt
	sudo chown pi:pi /opt/
	cd /opt/
	git clone https://github.com/timotoots/rtv.git


# Start script on boot
sudo nano /etc/rc.local

	add line:
	screen -dm -S rtvserver /opt/rtv/client/startup.sh


# Prevent SD Card corrupt 

Follow:

https://hallard.me/raspberry-pi-read-only/



----------------------------------------------------------------------

# Follow next steps only for client A:


# Install new Node JS 7

	curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash -
	sudo apt-get install nodejs


# Install AminoGFX library

https://github.com/joshmarinacci/aminogfx-gl  

	sudo apt-get install libjpeg-dev libavformat-dev libswscale-dev libavcodec-dev

	cd /opt/rtv/client/visual
	npm install aminogfx-gl
	npm install mqtt
	mv node_modules/aminogfx-gl .
	node /opt/rtv/client/visual/aminogfx-gl/demos/size.js


# Install Paho MQTT module for Python3

	sudo pip3 install paho-mqtt


# Disable console blanking

sudo nano /etc/kbd/config

	BLANK_TIME=0
	POWERDOWN_TIME=0 

sudo nano /boot/cmdline.txt
	
	set consoleblank=0

sudo nano /boot/config.txt

	add line: gpu_mem=180


----------------------------------------------------------------------


# Build and install Sweep SDK / only rtv2A
	
https://github.com/scanse/sweep-sdk/blob/master/libsweep/README.md  

	sudo apt-get install cmake

	cd /opt/
	git clone https://github.com/scanse/sweep-sdk.git

sudo nano /boot/config.txt

	add line: max_usb_current=1


----------------------------------------------------------------------

