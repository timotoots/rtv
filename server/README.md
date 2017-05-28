# Server

* Processes images and controls graphics on clients by MQTT.


# Installation

* Install Ubuntu 14.04


sudo apt-get update
sudo apt-get install ssh
sudo apt-get upgrade
sudo apt-get install mosquitto git 

sudo reboot

sudo chown timo:timo /opt/
cd /opt/
git clone https://github.com/timotoots/rtv.git

# Start script on boot
sudo nano /etc/rc.local

	add line:
	/opt/rtv/server/startup.sh &