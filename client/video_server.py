#!/usr/bin/env python
from subprocess import Popen, PIPE

from flask import Flask, request, Response
app = Flask(__name__)

@app.route('/')
def video():
    # default options
    options = {'timeout': 0, 'width': 1296, 'height': 972, 'framerate': 40, 'o': '-'}
    # override default options with request parameters
    options.update(request.args)
    # compose commandline
    cmdline = ['raspivid']
    for name, value in options.iteritems():
        # add option name, one dash for short options, two dashes for long options
        cmdline.append(('-' if len(name) == 1 else '--') + name)
        # if multiple values then concatenate using comma
        if isinstance(value, list):
            value = ','.join(value)
        # add option value if not empty
        if value != '':
            cmdline.append(str(value))
    print('starting process: ' + str(cmdline))

    def generate():
        process = Popen(cmdline, stdout=PIPE, stderr=PIPE)
        try:
            while True:
                buf = process.stdout.read(8192)
                if buf:
                    yield buf
                else:
                    break
        except:
            print('client disconnected, killing process')
            process.terminate()
            process.wait()
    return Response(generate(), mimetype='video/mp4')

if __name__ == '__main__':
    app.run(host='0.0.0.0')