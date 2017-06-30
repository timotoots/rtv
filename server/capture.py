import argparse
from multiprocessing import Process, Queue, Array, Value
import numpy as np
import cv2
import os
import sys

def capture(last_frame, done, args):
    print "Starting capture..."

    cap = cv2.VideoCapture()
    while not done.value:
        ret, img = cap.read()
        # handle video server restarts
        if not ret:
            if args.video_source == 'camera':
                cap.open(args.video_camera)
            elif args.video_source == 'url':
                cap.open(args.video_url)
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

def processing(last_frame, done, args):
    print "Starting processing..."

    pattern_size = (args.cols, args.rows)
    count = 0
    while count < args.count:
        img = np.frombuffer(last_frame.raw, dtype=np.uint8)
        img = img.reshape((args.frame_height, args.frame_width, 3))

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        if args.pattern == 'chess':
            ret, corners = cv2.findChessboardCorners(gray, pattern_size, flags=cv2.CALIB_CB_FAST_CHECK)
        elif args.pattern == 'circles':
            ret, corners = cv2.findCirclesGrid(gray, pattern_size, flags=cv2.CALIB_CB_ASYMMETRIC_GRID)
        else:
            assert False
        cv2.drawChessboardCorners(img, pattern_size, corners, ret)

        if ret:
            cv2.imwrite(os.path.join(args.output_dir, 'frame%03d.jpg' % count), gray)
            count += 1
            print "\r", count,
            sys.stdout.flush()

        # Display the resulting frame
        cv2.imshow('img', img)
        if cv2.waitKey(args.interval) & 0xFF == 27:
            break

    # When everything done, release the capture
    done.value = 1
    cv2.destroyAllWindows()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir")
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--rows", type=int, default=6)
    parser.add_argument("--cols", type=int, default=9)
    parser.add_argument("--pattern", choices=['chess', 'circles'], default='chess')
    parser.add_argument("--interval", type=int, default=1000)
    parser.add_argument("--frame_width", type=int, default=640)
    parser.add_argument("--frame_height", type=int, default=480)
    parser.add_argument("--video_source", choices=['camera', 'url'], default='url')
    parser.add_argument("--video_url", default='http://rtv1b.local:5000/?width=640&height=480&framerate=40&drc=high&hflip=&nopreview=')
    parser.add_argument("--video_camera", type=int, default=0)
    args = parser.parse_args()

    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)

    # set up interprocess communication buffers
    img = np.zeros((args.frame_height, args.frame_width, 3), dtype=np.uint8)
    buf = img.tostring()
    last_frame = Array('c', len(buf))
    last_frame.raw = buf
    done = Value('i', 0)

    # launch capture process
    c = Process(name='capture', target=capture , args=(last_frame, done, args))
    c.start()

    # launch face detection process
    p = Process(name='processing', target=processing, args=(last_frame, done, args))
    p.start()

    # wait for processes to finish
    p.join()
    c.join()
