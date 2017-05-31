from subprocess import Popen, PIPE
import shlex

from flask import Flask, Response
app = Flask(__name__)

@app.route('/')
def video():
    def generate():
        process = Popen(shlex.split('raspivid -t 0  -w 1296 -h 972 -fps 20 -o -'), stdout=PIPE, stderr=PIPE)
        try:
            while True:
                buf = process.stdout.read(8192)
                if buf:
                    yield buf
                else:
                    break
        except:
            app.logger.warning('client disconnected, killing process')
            process.terminate()
            process.wait()
    return Response(generate(), mimetype='video/mp4')

if __name__ == '__main__':
    app.run(host='0.0.0.0')