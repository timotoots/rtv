import cv2
import numpy as np
from multiprocessing import Process, Queue, Array, Value
import argparse
import sys
import os

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

def processing(left_frame, right_frame, done, args):
    print "Starting processing..."

    pattern_size = (args.rows, args.cols)

    count = 0
    while count < args.count:
        left_img = np.frombuffer(left_frame.raw, dtype=np.uint8)
        left_img = left_img.reshape((args.frame_height, args.frame_width, 3))

        right_img = np.frombuffer(right_frame.raw, dtype=np.uint8)
        right_img = right_img.reshape((args.frame_height, args.frame_width, 3))

        left_gray = cv2.cvtColor(left_img, cv2.COLOR_BGR2GRAY)
        right_gray = cv2.cvtColor(right_img, cv2.COLOR_BGR2GRAY)

        left_ret, corners = cv2.findChessboardCorners(left_gray, pattern_size, None, cv2.CALIB_CB_FAST_CHECK)
        cv2.drawChessboardCorners(left_img, pattern_size, corners, left_ret)

        right_ret, corners = cv2.findChessboardCorners(right_gray, pattern_size, None, cv2.CALIB_CB_FAST_CHECK)
        cv2.drawChessboardCorners(right_img, pattern_size, corners, left_ret)

        if left_ret & right_ret:
            cv2.imwrite(os.path.join(args.output_dir, 'left%03d.jpg' % count), left_gray)
            cv2.imwrite(os.path.join(args.output_dir, 'right%03d.jpg' % count), right_gray)
            count += 1
            print "\r", count,
            sys.stdout.flush()

        cv2.imshow('left', left_img)
        cv2.imshow('right', right_img)

        if cv2.waitKey(args.interval) & 0xFF == 27:
            break

    # when everything is done
    done.value = 1
    cv2.destroyAllWindows()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir")
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--rows", type=int, default=6)
    parser.add_argument("--cols", type=int, default=9)
    parser.add_argument("--interval", type=int, default=1000)
    parser.add_argument("--frame_width", type=int, default=640)
    parser.add_argument("--frame_height", type=int, default=480)
    parser.add_argument("--left_video_source", choices=['camera', 'url'], default='url')
    parser.add_argument("--left_video_url", default='http://rtv1b.local:5000/?width=640&height=480&framerate=40&drc=high&hflip=&nopreview=')
    parser.add_argument("--left_video_camera", type=int, default=3)
    parser.add_argument("--right_video_source", choices=['camera', 'url'], default='url')
    parser.add_argument("--right_video_url", default='http://rtv1.local:5000/?width=640&height=480&framerate=40&drc=high&hflip=&nopreview=')
    parser.add_argument("--right_video_camera", type=int, default=1)
    args = parser.parse_args()

    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)

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

    # launch face detection process
    p = Process(name='processing', target=processing, args=(left_frame, right_frame, done, args))
    p.start()

    # wait for processes to finish
    p.join()
    cl.join()
    cr.join()
