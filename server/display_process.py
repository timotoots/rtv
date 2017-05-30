import cv2
import dlib
import numpy as np
import paho.mqtt.client as paho
from multiprocessing import Process, Queue, Array, Value

# dlib-based feature extraction
JAWLINE_POINTS = list(range(0, 17))
RIGHT_EYEBROW_POINTS = list(range(17, 22))
LEFT_EYEBROW_POINTS = list(range(22, 27))
NOSE_POINTS = list(range(27, 36))
RIGHT_EYE_POINTS = list(range(36, 42))
LEFT_EYE_POINTS = list(range(42, 48))
MOUTH_OUTLINE_POINTS = list(range(48, 61))
MOUTH_INNER_POINTS = list(range(61, 68))

calib = np.array([
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

calib_width = 3280          # actual image width used for calibration
calib_height = 2464         # actual image height used for calibration

#frame_width = 320           # camera frame width
#frame_height = 240          # camera frame height
frame_width = 640           # camera frame width
frame_height = 480          # camera frame height
#frame_width = 800           # camera frame width
#frame_height = 600          # camera frame height
#frame_width = 1296          # camera frame width
#frame_height = 972          # camera frame height

# flip calibration values
calib[:, :, :, 0] = calib_width - calib[:, :, :, 0]
calib = np.flipud(calib)

# rescale calibration constants to frame size
calib[:, :, :, 0] *= float(frame_width) / calib_width
calib[:, :, :, 1] *= float(frame_height) / calib_height
#print calib

Z1 = 1000.0                 # first depth 1m
Z2 = 2000.0                 # second depth 2m

W1 = calib[0, 0, 0, 0] - calib[1, 0, 0, 0]  # width at 1m
W2 = calib[0, 1, 0, 0] - calib[1, 1, 0, 0]  # width at 2m
H1 = calib[1, 0, 1, 1] - calib[1, 0, 0, 1]  # height at 1m
H2 = calib[1, 1, 1, 1] - calib[1, 1, 0, 1]  # height at 2m
#print W1, H1, W2, H2

X1 = calib[1, 0, 0, 0]      # left at 1m
Y1 = calib[1, 0, 0, 1]      # top at 1m
X2 = calib[1, 1, 0, 0]      # left at 2m
Y2 = calib[1, 1, 0, 1]      # top at 2m
#print X1, Y1, X2, Y2

SX = 1388.0                 # left of tv screen in mm
SY = 0.0                    # top of tv screen in mm
SW = 1244.0                 # width of tv screen in mm
SH = 677.0                  # height of tv screen in mm

# inputs: camera coordinates cx, cy, real depth rz
def convert(cx, cy, rz):
    df = (rz - Z1) / (Z2 - Z1)
    aw = W1 - df * (W1 - W2)
    ah = H1 - df * (H1 - H2)
    ax = X1 + df * (X2 - X1)
    ay = Y1 + df * (Y2 - Y1)
    #print df, aw, ah, ax, ay

    rx = (cx - ax) * SW / aw + SX
    ry = (cy - ay) * SH / ah + SY
    #print cy, ay, SH, ah, SY
    
    return rx, ry

def capture(last_frame, done):
    print "Starting capture..."

    #video_capture = cv2.VideoCapture(0)
    video_capture = cv2.VideoCapture('http://192.168.22.22:5000/')
    assert video_capture.isOpened()

    while not done.value:
        #print "Reading frame..."
        ret, img = video_capture.read()
        assert ret
        #img = cv2.imread('l1.jpg')
        #print img.shape
        img = cv2.resize(img, (frame_width, frame_height))
        img = cv2.flip(img, 1)
        last_frame.raw = img.tostring()

    video_capture.release()

def processing(last_frame, done):
    print "Starting processing..."

    faces_dlib = dlib.get_frontal_face_detector()
    predictor_path = 'shape_predictor_68_face_landmarks.dat'
    predictor = dlib.shape_predictor(predictor_path)

    broker = "192.168.22.20"
    port = 1883

    client1 = paho.Client("tm")     # create client object
    client1.connect(broker, port)   # establish connection

    while True:
        img = np.frombuffer(last_frame.raw, dtype=np.uint8)
        img = img.reshape((frame_height, frame_width, 3))
        #print img.shape
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        detected_faces_dlib = faces_dlib(gray, 1)

        # Draw a rectangle aroudn the faces (dlib)
        for i, d in enumerate(detected_faces_dlib):
            x = d.left()
            y = d.bottom()
            w = d.right() - d.left()
            h = d.top() - d.bottom()
            cv2.rectangle(img, (x, y), (x + w, y + h), (255, 0, 255), 2)

            #rx, ry = convert(d.left(), d.top(), 2000)
            #ret = client1.publish("rtv2/square/1", "%d,%d" % (rx, ry)) # publish
            #rx, ry = convert(d.right(), d.bottom(), 2000)
            #ret = client1.publish("rtv2/square/2", "%d,%d" % (rx, ry)) # publish

            dlib_rect = dlib.rectangle(d.left(), d.top(), d.right(), d.bottom())
            detected_landmarks = predictor(gray, dlib_rect).parts()

            landmarks = np.matrix([[p.x, p.y] for p in detected_landmarks])
            landmarks_display = landmarks #[RIGHT_EYE_POINTS + LEFT_EYE_POINTS]

            landmarks_list = []
            for idx, point in enumerate(landmarks_display):
                pos = (point[0, 0], point[0, 1])
                # annotate the positions
                #cv2.putText(img, str(idx), pos,
                #            fontFace=cv2.FONT_HERSHEY_SIMPLEX,
                #            fontScale=0.4,
                #            color=(0, 0, 255))
                cv2.circle(img, pos, 2, color=(0, 255, 255), thickness=-1)
                landmarks_list.append(list(convert(pos[0], pos[1], 2000)))
            ret = client1.publish("rtv2/face/%d" % (i + 1), str(landmarks_list)) # publish

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
    img = np.empty((frame_height, frame_width, 3), dtype=np.uint8)
    buf = img.tostring()
    last_frame = Array('c', len(buf))
    last_frame.raw = buf
    done = Value('i', 0)

    c = Process(name='capture', target=capture, args=(last_frame, done))
    c.start()

    p = Process(name='processing', target=processing, args=(last_frame, done))
    p.start()

    p.join()
    c.join()
