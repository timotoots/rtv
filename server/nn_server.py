import argparse
import os
import cPickle as pickle
import numpy as np
from sklearn.neighbors import NearestNeighbors
from flask import Flask, Response, request, jsonify
import paho.mqtt.client as paho
import time
import logging

# suppress Flask messages
#logging.basicConfig(level=logging.WARNING, format='%(asctime)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S')

app = Flask(__name__)

@app.route('/', methods=['POST'])
def search():
    global faces, faces2persons, persons, reset_time, ping_time, mqtt, args

    # reset face db at regular intervals
    if time.time() - reset_time > args.reset_interval:
        logging.warning("resetting face database")
        faces = []
        faces2persons = []
        persons = []
        reset_time = time.time()

    # get JSON request
    content = request.get_json()
    descriptors = np.array(content)

    # if database is not empty
    if faces:
        # perform nearest neighbor search
        dists, face_ids = nn.kneighbors(descriptors)
        dists = dists[:, 0]
        face_ids = face_ids[:, 0]
    else:
        # force addition of all faces
        dists = [args.radius_same] * len(descriptors)
        face_ids = range(len(descriptors))

    refit = False
    person_ids = []
    for dist, face_id, desc in zip(dists, face_ids, descriptors):
        # if person already exists, use existing id
        if dist < args.radius_same:
            person_id = faces2persons[face_id]
            person_ids.append(person_id)
            # only add face if somewhat far from existing
            if dist > args.radius_same / 2:
                faces2persons.append(person_id)
                faces.append(desc)
                refit = True
        # if person is not in db, add it
        else:
            person_id = len(persons)
            person_ids.append(person_id)
            persons.append(str(person_id))
            faces2persons.append(person_id)
            faces.append(desc)
            refit = True

    # if added new faces, refit nearest neighbor database
    if refit:
        logging.warning('new faces added, rebuilding index')
        nn.fit(faces)

    # for monitoring
    if time.time() - ping_time > args.ping_interval:
        ret = mqtt.publish("server_log/%s/ping" % args.mqtt_name, '1')
        ping_time = time.time()

    return jsonify(person_ids)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--db")
    parser.add_argument("--nn_algorithm", choices=['auto', 'ball_tree', 'kd_tree', 'brute'], default='auto')
    parser.add_argument("--radius_same", type=float, default=0.5)
    parser.add_argument("--mqtt_name", default='nn_server')
    parser.add_argument("--mqtt_host", default='10.0.0.40')
    parser.add_argument("--mqtt_port", type=int, default=1883)
    parser.add_argument("--ping_interval", type=int, default=30*60)     # 30 mins
    parser.add_argument("--reset_interval", type=int, default=24*60*60) # 24 hours
    parser.add_argument("--debug", action='store_true', default=False)
    parser.add_argument("--profile")
    args = parser.parse_args()

    if args.profile:
        profile_dir = 'nn_server_profile_%s' % args.profile
        try:
            os.makedirs(profile_dir)
        except OSError as exception:
            if exception.errno != errno.EEXIST:
                raise
        from werkzeug.contrib.profiler import ProfilerMiddleware
        app.wsgi_app = ProfilerMiddleware(app.wsgi_app, profile_dir=profile_dir)

    nn = NearestNeighbors(n_neighbors=1, algorithm=args.nn_algorithm)

    if args.db and os.path.isfile(args.db):
        with open(args.db, 'rb') as f:
            faces, faces2persons, persons = pickle.load(f)
        nn.fit(faces)
    else:
        faces = []
        faces2persons = []
        persons = []

    mqtt = paho.Client(args.mqtt_name)     # create client object
    mqtt.connect(args.mqtt_host, args.mqtt_port)   # establish connection
    mqtt.loop_start()

    reset_time = time.time()
    ping_time = 0

    app.run(debug=args.debug)

    mqtt.loop_stop()

    if args.db:
        with open(args.db, 'wb') as f:
            pickle.dump([faces, faces2persons, persons], f, protocol=pickle.HIGHEST_PROTOCOL)
    print "faces: %d, persons: %d" % (len(faces), len(persons))
