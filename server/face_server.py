import cv2
import dlib
import numpy as np
import paho.mqtt.client as paho
from multiprocessing import Process, Queue, Array, Value
import time
import math
import argparse

model_points = np.array([[-58.0000323 , -41.51291   , -52.8319    ],
       [-47.7441823 , -46.76466   , -41.85545   ],
       [-37.4883323 , -52.01641   , -30.879     ],
       [-25.9699323 , -48.59791   , -27.6035    ],
       [-14.4515323 , -45.17941   , -24.328     ],
       [ 13.5701677 , -45.33691   , -24.342     ],
       [ 25.1354177 , -48.85021   , -27.7195    ],
       [ 36.7006677 , -52.36351   , -31.097     ],
       [ 47.0561677 , -46.99616   , -42.03345   ],
       [ 57.4116677 , -41.62881   , -52.9699    ],
       [ -0.2256323 , -25.40266   , -34.73405   ],
       [ -0.15042153, -16.93510667, -23.15603333],
       [ -0.07521077,  -8.46755333, -11.57801667],
       [  0.        ,  -0.        ,   0.        ],
       [-15.3779323 ,  12.34608   , -25.983     ],
       [ -7.7827843 ,  14.665085  , -21.222     ],
       [ -0.1876363 ,  16.98409   , -16.461     ],
       [  7.3577157 ,  14.53822   , -21.241     ],
       [ 14.9030677 ,  12.09235   , -26.021     ],
       [-43.3181323 , -28.83081   , -45.8156    ],
       [-35.77719897, -31.98374333, -39.97986667],
       [-27.5724323 , -31.59861   , -38.0605    ],
       [-18.7038323 , -27.67541   , -40.0575    ],
       [-26.4052323 , -25.90094333, -38.46723333],
       [-34.60999897, -26.28607667, -40.3866    ],
       [ 17.6545677 , -27.58241   , -40.3074    ],
       [ 26.5677677 , -31.59114333, -38.38306667],
       [ 34.92710103, -31.96537667, -40.2259    ],
       [ 42.7325677 , -28.70511   , -45.8359    ],
       [ 33.87443437, -26.24464333, -40.47143333],
       [ 25.51510103, -25.87041   , -38.6286    ],
       [-29.8132323 ,  39.02869   , -33.7847    ],
       [-18.5566323 ,  32.74149   , -23.596     ],
       [ -5.9109223 ,  28.19249   , -15.918     ],
       [ -0.2052573 ,  29.39079   , -15.352     ],
       [  5.4706877 ,  28.19949   , -15.905     ],
       [ 18.1418677 ,  32.67529   , -23.696     ],
       [ 29.5043677 ,  38.70579   , -34.0885    ],
       [ 21.5761677 ,  40.84079   , -28.45816667],
       [ 11.68540637,  42.93535667, -23.30066667],
       [ -0.1679163 ,  44.98949   , -18.616     ],
       [-11.9570603 ,  42.94222333, -23.244     ],
       [-21.8388323 ,  40.95529   , -28.30023333]])

landmark_indexes = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33,
       34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
       51, 52, 53, 54, 55, 56, 57, 58, 59]

def eulerAnglesToRotationMatrix(theta) :
     
    R_x = np.array([[1,         0,                  0                   ],
                    [0,         math.cos(theta[0]), -math.sin(theta[0]) ],
                    [0,         math.sin(theta[0]), math.cos(theta[0])  ]
                    ])
         
         
                     
    R_y = np.array([[math.cos(theta[1]),    0,      math.sin(theta[1])  ],
                    [0,                     1,      0                   ],
                    [-math.sin(theta[1]),   0,      math.cos(theta[1])  ]
                    ])
                 
    R_z = np.array([[math.cos(theta[2]),    -math.sin(theta[2]),    0],
                    [math.sin(theta[2]),    math.cos(theta[2]),     0],
                    [0,                     0,                      1]
                    ])
                     
                     
    R = np.dot(R_z, np.dot( R_y, R_x))
 
    return R

# from https://www.raspberrypi.org/documentation/hardware/camera/
sensorWidth = 3.68  # in mm
sensorHeight = 2.76 # in mm
focalLength = 3.04  # in mm

def get_camera_matrix(imageWidth, imageHeight):
    fx = imageWidth * focalLength / sensorWidth # in px
    fy = imageHeight * focalLength / sensorHeight # in px
    cx = imageWidth / 2 # in px
    cy = imageHeight / 2 # in px
    return np.array([[fx, 0, cx], [0, fy, cy], [0, 0, 1]], dtype=np.float32)

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

    faces_dlib = dlib.get_frontal_face_detector()
    predictor = dlib.shape_predictor(args.predictor_path)
    #facerec = dlib.face_recognition_model_v1(args.face_rec_model_path)

    camera_matrix = get_camera_matrix(args.frame_width, args.frame_height)
    camera_rotation = eulerAnglesToRotationMatrix((np.radians(args.camera_anglex), np.radians(args.camera_angley), np.radians(args.camera_anglez)))

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
            #x = rect.left()
            #y = rect.bottom()
            #w = rect.right() - rect.left()
            #h = rect.top() - rect.bottom()
            #cv2.rectangle(img, (x, y), (x + w, y + h), (255, 0, 255), 2)

            landmarks = predictor(gray, rect)
            landmarks = np.matrix([[p.x, p.y] for p in landmarks.parts()], dtype=np.float32)
            for idx, pos in enumerate(landmarks):
                # annotate the positions
                #cv2.putText(img, str(idx), pos,
                #            fontFace=cv2.FONT_HERSHEY_SIMPLEX,
                #            fontScale=0.4,
                #            color=(0, 0, 255))
                cv2.circle(img, (pos[0, 0], pos[0, 1]), 1, color=(0, 255, 255), thickness=-1)

            ret, rotation_vector, translation_vector = cv2.solvePnP(model_points, landmarks[landmark_indexes], camera_matrix, None)
            assert ret
            if translation_vector[2] > 0:
                #print "rotation_vector:", rotation_vector
                #print "translation_vector:", translation_vector
                #print "model_points:", model_points
                #print "landmarks:", landmarks
                translation_vector = translation_vector[:, 0]   # strip useless dimension
                translation_vector = np.dot(translation_vector, camera_rotation)
                translation_vector += (args.camera_x, args.camera_y, args.camera_z)

                #landmarks_mm = model_points + translation_vector
                #cv2.putText(img, "x: %f, y: %f, z: %f" % tuple(translation_vector), (5, 25), fontFace=cv2.FONT_HERSHEY_SIMPLEX, fontScale=0.5, color=(0, 255, 0), thickness=1)
                #ret = client1.publish("rtv_all/face/%d" % (args.face_id_base + i + 1), str(landmarks_mm[:, :2].tolist())) # publish

                landmarks_mm = (landmarks - landmarks[30]) * 1.5 + translation_vector[:2]

                if np.mean(landmarks_mm[:,0]) >= args.tv_left and np.mean(landmarks_mm[:,0]) <= args.tv_right:
                    ret = client1.publish("rtv_all/face/%d" % (args.face_id_base + i + 1), str(landmarks_mm.tolist())) # publish
                    #ret = client1.publish("rtv_all/square/%d" % (args.face_id_base + i + 1), "%d,%d" % (translation_vector[0], translation_vector[1])) # publish


        fps_frames += 1
        fps_elapsed	= time.time() -	fps_start
        fps	= fps_frames / fps_elapsed
        text = "FPS: %.2f" % fps
        text_size, _ = cv2.getTextSize(text, fontFace=cv2.FONT_HERSHEY_SIMPLEX,	fontScale=0.5, thickness=1)
        cv2.putText(img, text, (img.shape[1] - text_size[0]	- 5, img.shape[0]	- text_size[1]), fontFace=cv2.FONT_HERSHEY_SIMPLEX,	fontScale=0.5, color=(255, 255,	255), thickness=1)

        cv2.imshow('img', img)
        if cv2.waitKey(1) & 0xFF == 27:
            done.value = 1
            break

    # When everything is done, release the capture
    cv2.destroyAllWindows()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--frame_width", type=int, default=640)
    parser.add_argument("--frame_height", type=int, default=480)
    parser.add_argument("--camera_x", type=int, default=697)
    parser.add_argument("--camera_y", type=int, default=113)
    parser.add_argument("--camera_z", type=int, default=10)
    parser.add_argument("--camera_anglex", type=float, default=14)
    parser.add_argument("--camera_angley", type=float, default=-1.5)
    parser.add_argument("--camera_anglez", type=float, default=0)
    parser.add_argument("--tv_left", type=int, default=0)
    parser.add_argument("--tv_right", type=int, default=1388)
    parser.add_argument("--mqtt_name", default='tm')
    parser.add_argument("--mqtt_host", default='192.168.22.20')
    parser.add_argument("--mqtt_port", type=int, default=1883)
    parser.add_argument("--predictor_path", default='shape_predictor_68_face_landmarks.dat')
    parser.add_argument("--face_rec_model_path", default='dlib_face_recognition_resnet_model_v1.dat')    
    parser.add_argument("--dlib_upscale", type=int, default=0)
    parser.add_argument("--face_id_base", type=int, default=0)
    parser.add_argument("--video_source", choices=['camera', 'url'], default='url')
    parser.add_argument("--video_url", default='http://192.168.22.21:5000/?width=640&height=480&framerate=40&nopreview=')
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