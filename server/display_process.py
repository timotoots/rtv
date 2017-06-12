import cv2
import dlib
import numpy as np
import paho.mqtt.client as paho
from multiprocessing import Process, Queue, Array, Value
import time
import argparse

class Converter:
    def __init__(self, args):
        self.calib = np.array([
            [
                [
                    (3270, 672),    # right 1m top in pixels
                    (3056, 2264)    # right 1m bottom in pixels
                ],
                [
                    (2437, 612),    # right 2m top in pixels
                    (2374, 1471)    # right 2m bottom in pixels
                ]
            ],
            [
                [
                    (-45, 672),     # left 1m top in pixels
                    (216, 2270)     # left 1m bottom in pixels
                ],
                [
                    (782, 629),     # left 2m top in pixels
                    (865, 1485)     # left 2m bottom in pixels
                ]
            ]
        ], dtype=np.float32)
        # 1st RIGHT/LEFT, 2nd 1m/2m, 3rd upper/bottom, 4rd x/y

        self.calib_width = 3280          # actual image width used for calibration
        self.calib_height = 2464         # actual image height used for calibration

        # flip calibration values
        self.calib[:, :, :, 0] = self.calib_width - self.calib[:, :, :, 0]
        self.calib = np.flipud(self.calib)

        # rescale calibration constants to frame size
        self.calib[:, :, :, 0] *= float(args.frame_width) / self.calib_width
        self.calib[:, :, :, 1] *= float(args.frame_height) / self.calib_height
        #print self.calib

        self.Z1 = 1000.0                 # first depth 1m
        self.Z2 = 2000.0                 # second depth 2m

        self.W1 = self.calib[0, 0, 0, 0] - self.calib[1, 0, 0, 0]  # width at 1m
        self.W2 = self.calib[0, 1, 0, 0] - self.calib[1, 1, 0, 0]  # width at 2m
        self.H1 = self.calib[1, 0, 1, 1] - self.calib[1, 0, 0, 1]  # height at 1m
        self.H2 = self.calib[1, 1, 1, 1] - self.calib[1, 1, 0, 1]  # height at 2m
        #print W1, H1, W2, H2

        self.X1 = self.calib[1, 0, 0, 0]      # left at 1m
        self.Y1 = self.calib[1, 0, 0, 1]      # top at 1m
        self.X2 = self.calib[1, 1, 0, 0]      # left at 2m
        self.Y2 = self.calib[1, 1, 0, 1]      # top at 2m
        #print X1, Y1, X2, Y2

        self.SX = args.tv_left                # left of tv screen in mm
        self.SY = args.tv_top                 # top of tv screen in mm
        self.SW = args.tv_width               # width of tv screen in mm
        self.SH = args.tv_height              # height of tv screen in mm

    # inputs: camera coordinates cx, cy, real depth rz
    def convert(self, cx, cy, rz):
        df = (rz - self.Z1) / (self.Z2 - self.Z1)
        aw = self.W1 - df * (self.W1 - self.W2)
        ah = self.H1 - df * (self.H1 - self.H2)
        ax = self.X1 + df * (self.X2 - self.X1)
        ay = self.Y1 + df * (self.Y2 - self.Y1)
        #print df, aw, ah, ax, ay

        rx = (cx - ax) * self.SW / aw + self.SX
        ry = (cy - ay) * self.SH / ah + self.SY
        #print cy, ay, SH, ah, SY
        
        return int(rx), int(ry)

def capture(last_frame, done, args):
    print "Starting capture..."

    if args.video_source == 'camera':
        video_capture = cv2.VideoCapture(0)
    elif args.video_source == 'url':
        video_capture = cv2.VideoCapture(args.video_url)
    else:
        assert False
    assert video_capture.isOpened()
    #video_width = int(video_capture.get(cv2.cv.CV_CAP_PROP_FRAME_WIDTH))
    #video_height = int(video_capture.get(cv2.cv.CV_CAP_PROP_FRAME_HEIGHT))
    #video_fps = int(video_capture.get(cv2.cv.CV_CAP_PROP_FPS))
    #print "Video: %dx%d %dfps" % (video_width, video_height, video_fps)

    while not done.value:
        ret, img = video_capture.read()
        assert ret
        img = cv2.resize(img, (args.frame_width, args.frame_height))
        img = cv2.flip(img, 1)
        last_frame.raw = img.tostring()

    video_capture.release()

def processing(last_frame, done, args):
    print "Starting processing..."

    converter = Converter(args)

    faces_dlib = dlib.get_frontal_face_detector()
    predictor = dlib.shape_predictor(args.predictor_path)

    client1 = paho.Client(args.mqtt_name)     # create client object
    client1.connect(args.mqtt_host, args.mqtt_port)   # establish connection

    fps_start =	time.time()
    fps_frames = 0

    while True:
        img = np.frombuffer(last_frame.raw, dtype=np.uint8)
        img = img.reshape((args.frame_height, args.frame_width, 3))

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = faces_dlib(gray, args.dlib_upscale)

        # Draw a rectangle aroudn the faces (dlib)
        for i, rect in enumerate(faces):
            x = rect.left()
            y = rect.bottom()
            w = rect.right() - rect.left()
            h = rect.top() - rect.bottom()
            cv2.rectangle(img, (x, y), (x + w, y + h), (255, 0, 255), 2)

            rx, ry = converter.convert(rect.left(), rect.top(), 2000)
            ret = client1.publish("rtv_all/square/1", "%d,%d" % (rx, ry)) # publish
            rx, ry = converter.convert(rect.right(), rect.bottom(), 2000)
            ret = client1.publish("rtv_all/square/2", "%d,%d" % (rx, ry)) # publish

            facial_landmarks = predictor(gray, rect)

            landmarks_list = []
            for idx, p in enumerate(facial_landmarks.parts()):
                # annotate the positions
                #cv2.putText(img, str(idx), pos,
                #            fontFace=cv2.FONT_HERSHEY_SIMPLEX,
                #            fontScale=0.4,
                #            color=(0, 0, 255))
                cv2.circle(img, (p.x, p.y), 2, color=(0, 255, 255), thickness=-1)
                landmarks_list.append(list(converter.convert(p.x, p.y, 2000)))
            ret = client1.publish("rtv_all/face/%d" % (args.face_id_base + i + 1), str(landmarks_list)) # publish

        fps_frames += 1
        fps_elapsed	= time.time() -	fps_start
        fps	= fps_frames / fps_elapsed
        text = "FPS: %.2f" % fps
        text_size, _ = cv2.getTextSize(text, fontFace=cv2.FONT_HERSHEY_SIMPLEX,	fontScale=0.5, thickness=1)
        cv2.putText(img, text, (img.shape[1] - text_size[0]	- 5, img.shape[0]	- text_size[1]), fontFace=cv2.FONT_HERSHEY_SIMPLEX,	fontScale=0.5, color=(255, 255,	255), thickness=1)

        '''        
        cv2.line(img, tuple(calib[0,0,0]), tuple(calib[0,0,1]), (255, 255, 255), 2)
        cv2.line(img, tuple(calib[0,0,0]), tuple(calib[0,1,0]), (255, 255, 255), 2)
        cv2.line(img, tuple(calib[0,0,0]), tuple(calib[1,0,0]), (255, 255, 255), 2)

        cv2.line(img, tuple(calib[0,0,1]), tuple(calib[0,1,1]), (255, 255, 255), 2)
        cv2.line(img, tuple(calib[0,0,1]), tuple(calib[1,0,1]), (255, 255, 255), 2)

        cv2.line(img, tuple(calib[0,1,0]), tuple(calib[0,1,1]), (255, 255, 255), 2)
        cv2.line(img, tuple(calib[0,1,0]), tuple(calib[1,1,0]), (255, 255, 255), 2)

        cv2.line(img, tuple(calib[1,0,0]), tuple(calib[1,0,1]), (255, 255, 255), 2)
        cv2.line(img, tuple(calib[1,0,0]), tuple(calib[1,1,0]), (255, 255, 255), 2)

        cv2.line(img, tuple(calib[0,1,1]), tuple(calib[1,1,1]), (255, 255, 255), 2)
        cv2.line(img, tuple(calib[1,1,0]), tuple(calib[1,1,1]), (255, 255, 255), 2)
        cv2.line(img, tuple(calib[1,0,1]), tuple(calib[1,1,1]), (255, 255, 255), 2)
        '''

        cv2.imshow('img', img)
        if cv2.waitKey(1) & 0xFF == 27:
            done.value = 1
            break

    # When everything is done, release the capture
    cv2.destroyAllWindows()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--frame_width", type=int, default=1296)
    parser.add_argument("--frame_height", type=int, default=972)
    parser.add_argument("--tv_left", type=float, default=1388.0)
    parser.add_argument("--tv_top", type=float, default=0.0)
    parser.add_argument("--tv_width", type=float, default=1244.0)
    parser.add_argument("--tv_height", type=float, default=677.0)
    parser.add_argument("--mqtt_name", default='tm')
    parser.add_argument("--mqtt_host", default='192.168.22.20')
    parser.add_argument("--mqtt_port", type=int, default=1883)
    parser.add_argument("--predictor_path", default='shape_predictor_68_face_landmarks.dat')
    parser.add_argument("--dlib_upscale", type=int, default=0)
    parser.add_argument("--face_id_base", type=int, default=0)
    parser.add_argument("--video_source", choices=['camera', 'url'], default='url')
    parser.add_argument("--video_url", default='http://192.168.22.22:5000/?nopreview=')
    args = parser.parse_args()
    
    # set up interprocess communication buffers
    img = np.zeros((args.frame_height, args.frame_width, 3), dtype=np.uint8)
    buf = img.tostring()
    last_frame = Array('c', len(buf))
    last_frame.raw = buf
    done = Value('i', 0)

    # launch processes
    c = Process(name='capture', target=capture, args=(last_frame, done, args))
    c.start()

    p = Process(name='processing', target=processing, args=(last_frame, done, args))
    p.start()

    # wait for processes to finish
    p.join()
    c.join()
