import numpy as np
from sklearn.neighbors import NearestNeighbors

from flask import Flask, Response, request
app = Flask(__name__)

nn = NearestNeighbors(n_neighbors=1)
fit = False
faces = []
faces2persons = []
persons = []

@app.route('/', methods=['POST'])
def search():
    global fit
    # get JSON request
    content = request.get_json()
    face = np.array(content)

    if fit:
        dists, ids = nn.kneighbors(face[np.newaxis])
        if dists[0, 0] < 0.6:
            person_id = faces2persons[ids[0, 0]]
            faces2persons.append(person_id)
            faces.append(face)
            nn.fit(faces)
            return Response(persons[person_id], mimetype='application/json')

    person_id = len(persons)
    persons.append(str(person_id))
    faces2persons.append(person_id)
    faces.append(face)
    nn.fit(faces)
    fit = True
    return Response(persons[person_id], mimetype='application/json')

if __name__ == '__main__':
    app.run(debug=True)
