import os.path
import cPickle as pickle
import numpy as np
from sklearn.neighbors import NearestNeighbors

from flask import Flask, Response, request
app = Flask(__name__)

#from werkzeug.contrib.profiler import ProfilerMiddleware
#app.wsgi_app = ProfilerMiddleware(app.wsgi_app, profile_dir='nn_server_profile_sparse')

nn = NearestNeighbors(n_neighbors=1, algorithm='auto')

if os.path.isfile('nn_server.db'):
    with open('nn_server.db', 'rb') as f:
        faces, faces2persons, persons = pickle.load(f)
    nn.fit(faces)
else:
    faces = []
    faces2persons = []
    persons = []

@app.route('/', methods=['POST'])
def search():
    # get JSON request
    content = request.get_json()
    face = np.array(content)

    # if database not empty
    if faces:
        dists, ids = nn.kneighbors(face[np.newaxis])
        if dists[0, 0] < 0.6:
            person_id = faces2persons[ids[0, 0]]
            # only add new person if somewhat far from existing
            if dists[0, 0] > 0.3:
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
    app.run(debug=True)
    with open('nn_server.db', 'wb') as f:
        pickle.dump([faces, faces2persons, persons], f, protocol=pickle.HIGHEST_PROTOCOL)
    print "faces: %d, persons: %d" % (len(faces), len(persons))
