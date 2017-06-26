import argparse
import os.path
import cPickle as pickle
import numpy as np
from sklearn.neighbors import NearestNeighbors
from flask import Flask, Response, request

app = Flask(__name__)

@app.route('/', methods=['POST'])
def search():
    global args

    # get JSON request
    content = request.get_json()
    face = np.array(content)

    # if database not empty
    if faces:
        dists, ids = nn.kneighbors(face[np.newaxis])
        if dists[0, 0] < args.radius_same:
            person_id = faces2persons[ids[0, 0]]
            # only add new person if somewhat far from existing
            if dists[0, 0] > args.radius_extend:
                faces2persons.append(person_id)
                faces.append(face)
                nn.fit(faces)
            return Response(persons[person_id], mimetype='application/json')

    person_id = len(persons)
    persons.append(str(person_id))
    faces2persons.append(person_id)
    faces.append(face)
    nn.fit(faces)
    return Response(persons[person_id], mimetype='application/json')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default='nn_server.db')
    parser.add_argument("--nn_algorithm", choices=['auto', 'ball_tree', 'kd_tree', 'brute'], default='auto')
    parser.add_argument("--radius_same", type=float, default=0.6)
    parser.add_argument("--radius_extend", type=float, default=0.3)
    parser.add_argument("--debug", action='store_true', default=False)
    parser.add_argument("--profile")
    args = parser.parse_args()

    if args.profile:
        from werkzeug.contrib.profiler import ProfilerMiddleware
        app.wsgi_app = ProfilerMiddleware(app.wsgi_app, profile_dir='nn_server_profile_%s' & args.profile)

    nn = NearestNeighbors(n_neighbors=1, algorithm=args.nn_algorithm)

    if os.path.isfile(args.db):
        with open(args.db, 'rb') as f:
            faces, faces2persons, persons = pickle.load(f)
        nn.fit(faces)
    else:
        faces = []
        faces2persons = []
        persons = []

    app.run(debug=True)
    with open(args.db, 'wb') as f:
        pickle.dump([faces, faces2persons, persons], f, protocol=pickle.HIGHEST_PROTOCOL)
    print "faces: %d, persons: %d" % (len(faces), len(persons))
