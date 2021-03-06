import cv2
import dlib
import numpy as np
import paho.mqtt.client as paho
from multiprocessing import Process, Queue, Array, Value
from collections import defaultdict, deque
from functools import partial
import time
import math
import argparse
import os
import SimpleHTTPServer
import urlparse
import json
import sys
import requests

# general idea of estimating the distance to nose using reference 3D face
# http://www.learnopencv.com/head-pose-estimation-using-opencv-and-dlib/
# how to use cv2.solvePnP to estimate 3D location
# https://www.youtube.com/watch?v=bV-jAnQ-tvw

# adapted from Basel Face Model (MPEG4_FDP_face05.fp): http://faces.cs.unibas.ch/bfm/main.php?nav=1-1-0&id=details
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

# set zero point between eyes
model_points += model_points[27]
model_points *= 0.95

# correspondence between dlib landmarks and MPEG-4 Facial Feature Points based on:
# http://visagetechnologies.com/mpeg-4-face-and-body-animation/
landmark_indexes = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33,
       34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
       51, 52, 53, 54, 55, 56, 57, 58, 59]

# from https://www.learnopencv.com/rotation-matrix-to-euler-angles/
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

def capture_profile(last_frame, done, args):
    import cProfile
    command = """capture_org(last_frame, done, args)"""
    cProfile.runctx( command, globals(), locals(), filename="%s_capture.profile" % args.profile )

def capture_pprofile(last_frame, done, args):
    import pprofile
    prof = pprofile.Profile()
    try:
        with prof():
            capture(last_frame, done, args)
    except:
        pass
    prof.dump_stats("%s_capture.pprofile" % args.profile)
    prof.callgrind(open("callgrind.out.%s_capture" % args.profile, 'w'))

def capture(last_frame, done, args):
    print "Starting capture..."

    video_capture = cv2.VideoCapture()
    while not done.value:
        ret, img = video_capture.read()
        # handle video server restarts
        if not ret:
            if args.video_source == 'camera':
                video_capture.open(args.video_camera)
            elif args.video_source == 'url':
                video_capture.open(args.video_url)
            else:
                assert False
            '''
            if video_capture.isOpened():
                video_width = int(video_capture.get(cv2.cv.CV_CAP_PROP_FRAME_WIDTH))
                video_height = int(video_capture.get(cv2.cv.CV_CAP_PROP_FRAME_HEIGHT))
                video_fps = int(video_capture.get(cv2.cv.CV_CAP_PROP_FPS))
                print "Video: %dx%d %dfps" % (video_width, video_height, video_fps)
            '''
            continue
        img = cv2.resize(img, (args.frame_width, args.frame_height))
        img = cv2.flip(img, 1)
        last_frame.raw = img.tostring()

    video_capture.release()

def processing_profile(last_frame, done, args):
    import cProfile
    command = """processing_org(last_frame, done, args)"""
    cProfile.runctx( command, globals(), locals(), filename="%s_processing.profile" % args.profile )

def processing_pprofile(last_frame, done, args):
    import pprofile
    prof = pprofile.Profile()
    try:
        with prof():
            processing(last_frame, done, args)
    except:
        pass
    prof.dump_stats("%s_processing.pprofile" % args.profile)
    prof.callgrind(open("callgrind.out.%s_processing" % args.profile, 'w'))

def processing(last_frame, done, args):
    print "Starting processing..."

    detector = dlib.get_frontal_face_detector()
    predictor = dlib.shape_predictor(args.predictor_path)
    facerec = dlib.face_recognition_model_v1(args.face_rec_model_path)

    camera_matrix = get_camera_matrix(args.frame_width, args.frame_height)
    dist_coefs = None
    if args.calibration_file:
        calibration_data = np.load(args.calibration_file)
        camera_matrix = calibration_data['camera_matrix']
        dist_coefs = calibration_data['dist_coefs']
    camera_rotation = eulerAnglesToRotationMatrix((np.radians(args.camera_anglex), np.radians(args.camera_angley), np.radians(args.camera_anglez)))

    mqtt = paho.Client(args.mqtt_name)     # create client object
    mqtt.connect(args.mqtt_host, args.mqtt_port)   # establish connection
    mqtt.loop_start()

    fps_start =	time.time()
    fps_frames = 0

    frame_counts = defaultdict(int)
    tracking_frame = 0

    #face_coords = defaultdict(partial(deque, maxlen=5))
    face_coords = {}
    face_counts = defaultdict(int)

    while True:
        img = np.frombuffer(last_frame.raw, dtype=np.uint8)
        img = img.reshape((args.frame_height, args.frame_width, 3))

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # after every args.tracking_frames do full face detection
        if tracking_frame == 0 or not args.tracking_frames:
            faces = detector(gray, args.dlib_upscale)
            if args.tracking_frames:
                # set up trackers
                trackers = []
                for rect in faces:
                    tracker = dlib.correlation_tracker()
                    tracker.start_track(gray, rect)
                    trackers.append(tracker)
        else:
            # detect faces using tracker
            faces = []
            for tracker in trackers:
                tracker.update(gray)
                pos = tracker.get_position()
                rect = dlib.rectangle(int(pos.left()), int(pos.top()), int(pos.right()), int(pos.bottom()))
                faces.append(rect)

        # loop over faces
        for rect in faces:
            #print rect.top(), rect.bottom(), rect.left(), rect.right()
            # ignore faces that are partially outside of image
            if rect.left() < 0 or rect.right() >= args.frame_width or \
                    rect.top() < 0 or rect.bottom() >= args.frame_height:
                continue

            # detect landmarks from (grayscale) image
            landmarks = predictor(gray, rect)
            # compute face descriptor from (color!) image
            descriptor = facerec.compute_face_descriptor(img.copy(), landmarks)

            # ask nearest neighbor server for identity of this face descriptor
            try:
                r = requests.post(args.face_nn_url, json=list(descriptor))
                r.raise_for_status()
                face_id = int(r.text)
            except requests.exceptions.RequestException as e:
                print e
                # if any error occurs, set dummy face id
                face_id = 999999
            # convert landmarks to numpy array
            landmarks = np.array([[p.x, p.y] for p in landmarks.parts()])

            # enlarge face dimensions to get full face
            min_x, min_y = np.min(landmarks, axis=0)
            max_x, max_y = np.max(landmarks, axis=0)
            width = max_x - min_x
            height = max_y - min_y
            left = max(min_x - width // 5, 0)
            right = min(max_x + width // 5, args.frame_width - 1)
            top = max(min_y - height, 0)
            bottom = min(max_y + height // 5, args.frame_height - 1)

            # save face image to a folder, where it will be picked up by webserver
            face_img = img[top:bottom, left:right].copy()
            face_dir = 'person%02d' % (face_id)
            try:
                os.mkdir(os.path.join(args.faces_dir, face_dir))
            except:
                pass
            frame_counts[face_id] = (frame_counts[face_id] + 1) % args.save_frames
            face_file = 'frame%03d.jpg' % frame_counts[face_id]
            cv2.imwrite(os.path.join(args.faces_dir, face_dir, face_file), face_img)
            face_landmarks = landmarks - (left, top)    # convert face landmarks to be relative to left top of face image

            if args.display:
                # plot blue rectangle when detected using face detection, green when detected using tracking
                cv2.rectangle(img, (rect.left(), rect.top()), (rect.right(), rect.bottom()), (255, 0, 0) if tracking_frame == 0 else (0, 255, 0), thickness=2)
                # plot face landmarks for testing
                for idx, pos in enumerate(landmarks):
                    cv2.circle(img, tuple(pos), 1, color=(0, 255, 255), thickness=-1)
                # plot landmarks on face image for testing
                for idx, pos in enumerate(face_landmarks):
                    cv2.circle(face_img, tuple(pos), 1, color=(0, 255, 255), thickness=-1)
                # show each person in separate window
                cv2.imshow('face%d' % (face_id), face_img)

            # find the distance of camera from face (which is the same as distance of face from camera)
            ret, rotation_vector, translation_vector = cv2.solvePnP(model_points, landmarks[landmark_indexes].astype(np.float32), camera_matrix, dist_coefs)
            assert ret

            '''
            face_coords[face_id].append(translation_vector)
            translation_vector = np.mean(face_coords[face_id], axis=0)
            for i, face_queue in face_coords.iteritems():
                if i != face_id and face_queue:
                    face_queue.popleft()
            print list(face_coords)
            '''

            if face_id in face_coords:
                face_coords[face_id] = (1 - args.ewma_alpha) * face_coords[face_id] + args.ewma_alpha * translation_vector
            else:
                face_coords[face_id] = translation_vector
            face_counts[face_id] = args.ewma_count
            translation_vector = face_coords[face_id]
            #print face_coords
            #print face_counts

            # only display face when the estimated distance from mirror is positive
            if translation_vector[2] > 0:
                translation_vector = translation_vector[:, 0]                       # strip useless dimension
                translation_vector = np.dot(translation_vector, camera_rotation)    # fix error from camera angle
                translation_vector += (args.camera_x, args.camera_y, args.camera_z) # translate to global coordinates

                # convert image landmarks into mm landmarks, assuming flat face towards camera
                trans_matrix, mask = cv2.findHomography(landmarks[landmark_indexes].astype(np.float32), model_points[:,:2].astype(np.float32))
                landmarks_mm = cv2.perspectiveTransform(landmarks[np.newaxis].astype(np.float32), trans_matrix.astype(np.float32))[0]

                # ALTERNATIVES:
                # use only reference model points (face always flat)
                #landmarks_mm = model_points[:, :2]
                # replace known points with reference points
                #landmarks_mm[landmark_indexes] = model_points[:, :2]

                # convert landmarks into global coordinates, assuming that face image in mirror is 2x smaller
                # see http://www.physicsclassroom.com/class/refln/Lesson-2/What-Portion-of-a-Mirror-is-Required-to-View-an-Im
                landmarks_mm = landmarks_mm // 2 + translation_vector[:2]

                # only if landmarks are within the tv screen
                if args.tv_left <= np.mean(landmarks_mm[:,0]) <= args.tv_right:

                    min_x, min_y = np.min(landmarks_mm, axis=0)
                    max_x, max_y = np.max(landmarks_mm, axis=0)
                    width = max_x - min_x
                    height = max_y - min_y
                    left = min_x - width // 5
                    right = max_x + width // 5
                    top = min_y - height
                    bottom = max_y + height // 5

                    ret = mqtt.publish("rtv_all/face/%d" % (face_id), str(landmarks_mm.tolist())) # publish
                    #ret = mqtt.publish("rtv_all/square/%d" % (face_id), "%d,%d" % (translation_vector[0], translation_vector[1])) # publish
                    ret = mqtt.publish("rtv_all/face_new/%d" % (face_id), json.dumps({
                            'nose_global_mm': translation_vector.astype(np.int).tolist(),
                            'faceimg_global_mm': [left, top, right, bottom],
                            'landmarks_faceimg_px': face_landmarks.tolist(),
                            'landmarks_global_mm': landmarks_mm.astype(np.int).tolist(), 
                            'face_id': (face_id),
                            'frame_id': '%03d' % frame_counts[face_id],
                            'face_image_url': urlparse.urljoin(args.faces_url, os.path.join(face_dir, face_file))})) # publish

        for i in face_counts.keys():
            #print i, face_counts[i]
            if face_counts[i] > 0:
                face_counts[i] -= 1
            else:
                del face_coords[i]
                del face_counts[i]
        
        if args.tracking_frames:
            tracking_frame = (tracking_frame + 1) % args.tracking_frames

        fps_frames += 1
        fps_elapsed	= time.time() -	fps_start
        fps	= fps_frames / fps_elapsed
        print "\rFPS: %.2f" % fps,
        sys.stdout.flush()

        if args.display:
            text = "FPS: %.2f, frames: %d, elapsed: %f" % (fps, fps_frames, fps_elapsed)
            text_size, _ = cv2.getTextSize(text, fontFace=cv2.FONT_HERSHEY_SIMPLEX,	fontScale=0.5, thickness=1)
            cv2.putText(img, text, (img.shape[1] - text_size[0]	- 5, img.shape[0]	- text_size[1]), fontFace=cv2.FONT_HERSHEY_SIMPLEX,	fontScale=0.5, color=(255, 255,	255), thickness=1)

            cv2.imshow('img', img)
            if cv2.waitKey(1) & 0xFF == 27:
                done.value = 1
                break

        if fps_frames == args.fps_frames:
            fps_frames = 0
            fps_start = time.time()

    # when everything is done
    mqtt.loop_stop()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--calibration_file", default='raspberry_camera_module_v2_640x480.npz')
    parser.add_argument("--frame_width", type=int, default=640)
    parser.add_argument("--frame_height", type=int, default=480)
    parser.add_argument("--camera_x", type=int, default=697)
    parser.add_argument("--camera_y", type=int, default=113)
    parser.add_argument("--camera_z", type=int, default=10)
    parser.add_argument("--camera_anglex", type=float, default=14)
    parser.add_argument("--camera_angley", type=float, default=-1.5)
    parser.add_argument("--camera_anglez", type=float, default=0)
    parser.add_argument("--display", action="store_true", default=True)
    parser.add_argument("--no_display", action="store_false", dest='display')
    parser.add_argument("--tv_left", type=int, default=0)
    parser.add_argument("--tv_right", type=int, default=1388)
    parser.add_argument("--mqtt_name", default='tm')
    parser.add_argument("--mqtt_host", default='192.168.22.20')
    parser.add_argument("--mqtt_port", type=int, default=1883)
    parser.add_argument("--predictor_path", default='shape_predictor_68_face_landmarks.dat')
    parser.add_argument("--face_rec_model_path", default='dlib_face_recognition_resnet_model_v1.dat')    
    parser.add_argument("--dlib_upscale", type=int, default=0)
    parser.add_argument("--faces_dir", default="faces")
    parser.add_argument("--faces_url", default="http://192.168.22.20:8000/")
    parser.add_argument("--ewma_alpha", type=float, default=0.5)
    parser.add_argument("--ewma_count", type=int, default=10)
    parser.add_argument("--save_frames", type=int, default=1000)
    parser.add_argument("--tracking_frames", type=int, default=0)
    parser.add_argument("--fps_frames", type=int, default=100)
    parser.add_argument("--face_nn_url", default='http://localhost:5000/')
    parser.add_argument("--video_source", choices=['camera', 'url'], default='url')
    parser.add_argument("--video_url", default='http://192.168.22.21:5000/?width=640&height=480&framerate=40&nopreview=')
    parser.add_argument("--video_camera", type=int, default=0)
    parser.add_argument("--profile_type", choices=['profile', 'pprofile'], default='pprofile')
    parser.add_argument("--profile")
    args = parser.parse_args()
    
    # set up interprocess communication buffers
    img = np.zeros((args.frame_height, args.frame_width, 3), dtype=np.uint8)
    buf = img.tostring()
    last_frame = Array('c', len(buf))
    last_frame.raw = buf
    done = Value('i', 0)

    # launch capture process
    target = capture
    if args.profile:
        if args.profile_type == 'pprofile':
            target = capture_pprofile
        elif args.profile_type == 'profile':
            target = capture_profile
        else:
            assert False
    c = Process(name='capture', target=target , args=(last_frame, done, args))
    c.start()

    # launch face detection process
    target = processing
    if args.profile:
        if args.profile_type == 'pprofile':
            target = processing_pprofile
        elif args.profile_type == 'profile':
            target = processing_profile
        else:
            assert False
    p = Process(name='processing', target=target, args=(last_frame, done, args))
    p.start()

    # wait for processes to finish
    p.join()
    c.join()
