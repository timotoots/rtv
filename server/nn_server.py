import argparse
import os.path
import cPickle as pickle
import numpy as np
from sklearn.neighbors import NearestNeighbors
from flask import Flask, Response, request, jsonify

app = Flask(__name__)

@app.route('/', methods=['POST'])
def search():
    global faces, faces2persons, persons, args

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
            if dist > args.radius_extend:
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
        nn.fit(faces)

    return jsonify(person_ids)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--db")
    parser.add_argument("--nn_algorithm", choices=['auto', 'ball_tree', 'kd_tree', 'brute'], default='auto')
    parser.add_argument("--radius_same", type=float, default=0.4)
    parser.add_argument("--radius_extend", type=float, default=0.25)
    parser.add_argument("--debug", action='store_true', default=False)
    parser.add_argument("--profile")
    args = parser.parse_args()

    if args.profile:
        from werkzeug.contrib.profiler import ProfilerMiddleware
        app.wsgi_app = ProfilerMiddleware(app.wsgi_app, profile_dir='nn_server_profile_%s' & args.profile)

    nn = NearestNeighbors(n_neighbors=1, algorithm=args.nn_algorithm)

    if args.db and os.path.isfile(args.db):
        with open(args.db, 'rb') as f:
            faces, faces2persons, persons = pickle.load(f)
        nn.fit(faces)
    else:
        faces = []
        faces2persons = []
        persons = []

    app.run(debug=args.debug)
    
    if args.db:
        with open(args.db, 'wb') as f:
            pickle.dump([faces, faces2persons, persons], f, protocol=pickle.HIGHEST_PROTOCOL)
    print "faces: %d, persons: %d" % (len(faces), len(persons))
