# Rpi Client

* Takes image from webcam and streams to server

* Displays graphics by MQTT


# Installation


# Setup on Raspberry Pi
install Raspbian

# Raspberry Pi config
sudo raspi-config

	set hostname -> m3gateui
	set user password
	enable camera
	enable ssh
	boot to console




sudo nano /boot/config.txt

	* gpu_mem=180

sudo apt-get update
sudo apt-get upgrade
sudo reboot

# Install new Node JS

curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash -
sudo apt-get install nodejs

# Install Git repo

sudo chown pi:pi /opt/
cd /opt/
git clone https://github.com/timotoots/rtv.git


# Install AminoGFX library

sudo apt-get install libjpeg-dev libavformat-dev libswscale-dev libavcodec-dev

cd /opt/rtv/client
sudo npm install aminogfx-gl

# Install Sweek SDK

cd /opt/
https://github.com/scanse/sweep-sdk.git

# Disable console blanking

sudo nano /etc/kbd/config

	BLANK_TIME=0
	POWERDOWN_TIME=0 




# Start script on boot
sudo nano /etc/rc.local

	add line:
	/opt/rtv/client/startup.sh &