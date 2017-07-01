import cv2
import numpy as np
from multiprocessing import Process, Queue, Array, Value
from flask import Flask, send_file
import argparse
import io

def capture(last_frame, done, video_source, video_camera, video_url, args):
    print "Starting capture..."

    cap = cv2.VideoCapture()
    while not done.value:
        ret, img = cap.read()
        # handle video server restarts
        if not ret:
            if video_source == 'camera':
                cap.open(video_camera)
            elif video_source == 'url':
                cap.open(video_url)
            else:
                assert False
            '''
            if cap.isOpened():
                video_width = int(cap.get(cv2.cv.CV_CAP_PROP_FRAME_WIDTH))
                video_height = int(cap.get(cv2.cv.CV_CAP_PROP_FRAME_HEIGHT))
                video_fps = int(cap.get(cv2.cv.CV_CAP_PROP_FPS))
                print "Video: %dx%d %dfps" % (video_width, video_height, video_fps)
            '''
            continue
        # preprocess frame
        img = cv2.resize(img, (args.frame_width, args.frame_height))
        #img = cv2.flip(img, 1)
        last_frame.raw = img.tostring()

    cap.release()

app = Flask(__name__)

@app.route('/frame.jpg', methods=['GET'])
def frame():
    global left_frame, right_frame
    left_img = np.frombuffer(left_frame.raw, dtype=np.uint8)
    left_img = left_img.reshape((args.frame_height, args.frame_width, 3))

    right_img = np.frombuffer(right_frame.raw, dtype=np.uint8)
    right_img = right_img.reshape((args.frame_height, args.frame_width, 3))

    frame = np.hstack([left_img[:, :args.frame_width // 2], right_img[:, args.frame_width // 2:]])
    #cv2.rectangle(frame, (args.frame_width // 2, 0), (args.frame_width // 2 + 1, args.frame_height - 1), (255, 255, 0))

    ret, buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 100])
    return send_file(io.BytesIO(buf), attachment_filename='frame.jpg', mimetype='image/jpeg')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=5001)
    parser.add_argument("--frame_width", type=int, default=640)
    parser.add_argument("--frame_height", type=int, default=480)
    parser.add_argument("--left_video_source", choices=['camera', 'url'], default='url')
    parser.add_argument("--left_video_url", default='http://rtv1b.local:5000/?width=640&height=480&framerate=40&drc=high&hflip=&nopreview=')
    parser.add_argument("--left_video_camera", type=int, default=3)
    parser.add_argument("--right_video_source", choices=['camera', 'url'], default='url')
    parser.add_argument("--right_video_url", default='http://rtv1.local:5000/?width=640&height=480&framerate=40&drc=high&hflip=&nopreview=')
    parser.add_argument("--right_video_camera", type=int, default=1)
    args = parser.parse_args()

    # set up interprocess communication buffers
    img = np.zeros((args.frame_height, args.frame_width, 3), dtype=np.uint8)
    buf = img.tostring()
    left_frame = Array('c', len(buf))
    left_frame.raw = buf
    right_frame = Array('c', len(buf))
    right_frame.raw = buf
    done = Value('i', 0)

    # launch capture process
    cl = Process(name='capture_left', target=capture , args=(left_frame, done, args.left_video_source, args.left_video_camera, args.left_video_url, args))
    cl.start()

    cr = Process(name='capture_right', target=capture , args=(right_frame, done, args.right_video_source, args.right_video_camera, args.right_video_url, args))
    cr.start()

    app.run(host='0.0.0.0', port=args.port)
    done.value = 1
