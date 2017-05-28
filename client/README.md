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

curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash -
sudo apt-get install nodejs

sudo npm install aminogfx-gl