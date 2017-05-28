

#raspivid -t 0 -vf -w 800 -h 600 -fps 20 -o - | nc 192.168.33.12 5001
raspivid -t 0 -vf -w 800 -h 600 -fps 30
