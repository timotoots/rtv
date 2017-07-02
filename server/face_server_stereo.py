from __future__ import print_function
import cv2
import dlib
import numpy as np
import paho.mqtt.client as paho
import multiprocessing
from multiprocessing import Process, Queue, Array, Value
from collections import defaultdict, deque
import time
import math
import argparse
import os
import sys
#import urlparse
import json
import requests

def get_camera_matrix(imageWidth, imageHeight, sensorWidth, sensorHeight, focalLength):
    fx = imageWidth * focalLength / sensorWidth # in px
    fy = imageHeight * focalLength / sensorHeight # in px
    cx = imageWidth / 2 # in px
    cy = imageHeight / 2 # in px
    return np.array([[fx, 0, cx], [0, fy, cy], [0, 0, 1]], dtype=np.float32)

def get_proj_matrix(cameraMatrix, shift):
    trans = np.zeros((3, 1))
    trans[0,0] = cameraMatrix[0, 0] * shift
    return np.hstack([cameraMatrix, trans])

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

def capture_profile(last_frame, done, args):
    import cProfile
    command = """capture(last_frame, done, args)"""
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

def capture(last_frame, done, video_source, video_camera, video_url, args):
    print("Starting %s..." % multiprocessing.current_process().name)

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

def processing_profile(last_frame, done, args):
    import cProfile
    command = """processing(last_frame, done, args)"""
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

def processing(left_frame, right_frame, done, args):
    print("Starting %s..." % multiprocessing.current_process().name)

    detector = dlib.get_frontal_face_detector()
    predictor = dlib.shape_predictor(args.predictor_path)
    facerec = dlib.face_recognition_model_v1(args.face_rec_model_path)

    if args.calibration_file:
        calibration = np.load(args.calibration_file)
        left_camera_matrix = calibration['left_camera_matrix']
        # correct camera matrix for new resolution
        left_camera_matrix[0] *= float(args.frame_width) / calibration['image_width']
        left_camera_matrix[1] *= float(args.frame_height) / calibration['image_height']
        right_camera_matrix = calibration['right_camera_matrix']
        # correct camera matrix for new resolution
        right_camera_matrix[0] *= float(args.frame_width) / calibration['image_width']
        right_camera_matrix[1] *= float(args.frame_height) / calibration['image_height']
        left_dist_coefs = calibration['left_dist_coefs']
        right_dist_coefs = calibration['right_dist_coefs']
        left_rotation_matrix = calibration['left_rotation_matrix']
        right_rotation_matrix = calibration['right_rotation_matrix']
        left_proj_matrix = calibration['left_proj_matrix']
        right_proj_matrix = calibration['right_proj_matrix']
    else:
        left_camera_matrix = right_camera_matrix = get_camera_matrix(args.frame_width, args.frame_height, args.sensor_width, args.sensor_height, args.focal_length)
        left_dist_coefs = right_dist_coefs = np.array([[  2.08534841e-01,  -5.26737125e-01,  -8.08675824e-04, 1.97423599e-04,   4.07777369e-01]]) # np.array([[ 0.24229091, -0.57693401,  0.00773281, -0.00155601,  0.48140698]])
        left_rotation_matrix = right_rotation_matrix = None
        left_proj_matrix = get_proj_matrix(left_camera_matrix, 0)
        right_proj_matrix = get_proj_matrix(right_camera_matrix, args.right_camera_shift)

    camera_rotation = eulerAnglesToRotationMatrix((np.radians(args.camera_anglex), np.radians(args.camera_angley), np.radians(args.camera_anglez)))

    mqtt = paho.Client(args.mqtt_name)     # create client object
    mqtt.connect(args.mqtt_host, args.mqtt_port)   # establish connection
    mqtt.loop_start()

    fps_start =	time.time()
    fps_frames = 0

    while True:
        # fetch left and right images.
        # NB! there must be no processing in between fetching left and right, 
        # otherwise it confuses stereo vision.
        left_img = np.frombuffer(left_frame.raw, dtype=np.uint8)
        right_img = np.frombuffer(right_frame.raw, dtype=np.uint8)
        left_img = left_img.reshape((args.frame_height, args.frame_width, 3))
        right_img = right_img.reshape((args.frame_height, args.frame_width, 3))

        # detect left faces
        left_gray = cv2.cvtColor(left_img, cv2.COLOR_BGR2GRAY)
        left_faces = detector(left_gray, args.dlib_upscale)

        left_rects = []
        left_landmarkss = []
        left_descriptors = []
        for rect in left_faces:
            # ignore faces that are partially outside of image
            if rect.left() < 0 or rect.right() >= args.frame_width or \
                    rect.top() < 0 or rect.bottom() >= args.frame_height:
                continue

            # detect landmarks from (grayscale) image
            landmarks = predictor(left_gray, rect)

            # compute face descriptor from (color!) image
            descriptor = facerec.compute_face_descriptor(left_img.copy(), landmarks)

            left_rects.append(rect)
            left_landmarkss.append(landmarks)
            left_descriptors.append(list(descriptor))

        if left_descriptors:
            # ask nearest neighbor server for identity of this face descriptor
            try:
                r = requests.post(args.face_nn_url, json=left_descriptors)
                r.raise_for_status()
                left_ids = r.json()
            except requests.exceptions.RequestException as e:
                print(e)
                # if any error occurs, set dummy face id
                left_ids = 100000 + np.array(range(len(left_descriptors)))
        else:
            left_ids = []
        #print("left_ids:", left_ids)
        # convert arrays into dictionaries
        left_rects = {id: left_rects[i] for i, id in enumerate(left_ids)}
        left_landmarkss = {id: left_landmarkss[i] for i, id in enumerate(left_ids)}

        # detect right faces
        right_gray = cv2.cvtColor(right_img, cv2.COLOR_BGR2GRAY)
        right_faces = detector(right_gray, args.dlib_upscale)

        right_rects = []
        right_landmarkss = []
        right_descriptors = []
        for rect in right_faces:
            # ignore faces that are partially outside of image
            if rect.left() < 0 or rect.right() >= args.frame_width or \
                    rect.top() < 0 or rect.bottom() >= args.frame_height:
                continue

            # detect landmarks from (grayscale) image
            landmarks = predictor(right_gray, rect)

            # compute face descriptor from (color!) image
            descriptor = facerec.compute_face_descriptor(right_img.copy(), landmarks)

            right_rects.append(rect)
            right_landmarkss.append(landmarks)
            right_descriptors.append(list(descriptor))

        if right_descriptors:
            # ask nearest neighbor server for identity of this face descriptor
            try:
                r = requests.post(args.face_nn_url, json=right_descriptors)
                r.raise_for_status()
                right_ids = r.json()
            except requests.exceptions.RequestException as e:
                print(e)
                # if any error occurs, set dummy face id
                right_ids = 100000 + np.array(range(len(right_descriptors)))
        else:
            right_ids = []
        #print("right_ids:", right_ids)
        # convert arrays into dictionaries
        right_rects = {id: right_rects[i] for i, id in enumerate(right_ids)}
        right_landmarkss = {id: right_landmarkss[i] for i, id in enumerate(right_ids)}

        #left_img_undistorted = cv2.undistort(left_img, left_camera_matrix, left_dist_coefs)
        #right_img_undistorted = cv2.undistort(right_img, left_camera_matrix, left_dist_coefs)

        # loop over faces that appear both on left and right image
        for face_id in set(left_ids).intersection(right_ids):
            left_rect = left_rects[face_id]
            left_landmarks = left_landmarkss[face_id]
            right_rect = right_rects[face_id]
            right_landmarks = right_landmarkss[face_id]
            
            # convert landmarks to numpy array
            left_landmarks = np.array([[p.x, p.y] for p in left_landmarks.parts()], dtype=np.float32)
            right_landmarks = np.array([[p.x, p.y] for p in right_landmarks.parts()], dtype=np.float32)

            left_landmarks_undistorted = cv2.undistortPoints(left_landmarks[np.newaxis], left_camera_matrix, left_dist_coefs, R=left_rotation_matrix, P=left_proj_matrix)[0]
            right_landmarks_undistorted = cv2.undistortPoints(right_landmarks[np.newaxis], right_camera_matrix, right_dist_coefs, R=right_rotation_matrix, P=right_proj_matrix)[0]

            # find the distance of camera from face (which is the same as distance of face from camera)
            #print "left_proj_matrix:", left_proj_matrix.dtype
            #print "right_proj_matrix:", right_proj_matrix.dtype
            #print "left_landmarks:", left_landmarks.T.astype(np.float32).dtype
            #print "right_landmarks:", right_landmarks.T.astype(np.float32).dtype
            landmarks_mm = cv2.triangulatePoints(left_proj_matrix, right_proj_matrix, left_landmarks_undistorted.T, right_landmarks_undistorted.T)
            landmarks_mm /= landmarks_mm[3] # convert to homogeneous coordinates
            landmarks_mm = landmarks_mm[:3] # get rid of ones
            landmarks_mm = landmarks_mm.T   # coordinates as second dimension
            #print landmarks_mm, landmarks_mm.shape

            landmarks_mm = np.dot(landmarks_mm, camera_rotation)    # fix error from camera angle
            landmarks_mm += (args.camera_x, args.camera_y, args.camera_z) # translate to global coordinates

            # face image in mirror is 2x smaller
            # see http://www.physicsclassroom.com/class/refln/Lesson-2/What-Portion-of-a-Mirror-is-Required-to-View-an-Im
            center_mm = landmarks_mm[27]
            landmarks_mm = (landmarks_mm - center_mm) // 2 + center_mm

            # only if landmarks are within the tv screen
            if args.tv_left <= np.mean(landmarks_mm[:,0]) <= args.tv_right:
                #ret = mqtt.publish("rtv_all/face/%d" % (face_id), str(landmarks_mm.tolist())) # publish
                #ret = mqtt.publish("rtv_all/square/%d" % (face_id), "%d,%d" % (translation_vector[0], translation_vector[1])) # publish
                ret = mqtt.publish("rtv_all/face_new/%d" % (face_id), json.dumps({
                        'nose_global_mm': center_mm.astype(np.int).tolist(),
                        #'faceimg_global_mm': [left, top, right, bottom],
                        #'landmarks_faceimg_px': face_landmarks.tolist(),
                        'landmarks_global_mm': landmarks_mm.astype(np.int).tolist(), 
                        'face_id': (face_id)
                        #'frame_id': '%03d' % frame_counts[face_id],
                        #'face_image_url': urlparse.urljoin(args.faces_url, os.path.join(face_dir, face_file))}) # publish
                    }))

            if args.display:
                # plot blue rectangle when detected using face detection, green when detected using tracking
                cv2.rectangle(left_img, (left_rect.left(), left_rect.top()), (left_rect.right(), left_rect.bottom()), (255, 0, 0), thickness=2)
                cv2.rectangle(right_img, (right_rect.left(), right_rect.top()), (right_rect.right(), right_rect.bottom()), (255, 0, 0), thickness=2)

                # plot face landmarks for testing
                for pos in left_landmarks:
                    cv2.circle(left_img, tuple(pos), 1, color=(0, 255, 255), thickness=-1)
                for pos in right_landmarks:
                    cv2.circle(right_img, tuple(pos), 1, color=(0, 255, 255), thickness=-1)

                # plot face landmarks for testing
                #for pos in left_landmarks_undistorted:
                #    cv2.circle(left_img_undistorted, tuple(pos), 1, color=(0, 255, 255), thickness=-1)
                #for pos in right_landmarks_undistorted:
                #    cv2.circle(right_img_undistorted, tuple(pos), 1, color=(0, 255, 255), thickness=-1)

                text = "x: %d, y: %d, z: %d" % tuple(center_mm)
                cv2.putText(right_img, text, (5, right_img.shape[0] - 15), fontFace=cv2.FONT_HERSHEY_SIMPLEX, fontScale=0.5, color=(255, 255, 255), thickness=1)

        fps_frames += 1
        fps_elapsed	= time.time() -	fps_start
        fps	= fps_frames / fps_elapsed
        print("\rFPS: %.2f" % fps, end='')
        sys.stdout.flush()

        if args.display:
            text = "FPS: %.2f, frames: %d, elapsed: %f" % (fps, fps_frames, fps_elapsed)
            text_size, _ = cv2.getTextSize(text, fontFace=cv2.FONT_HERSHEY_SIMPLEX,	fontScale=0.5, thickness=1)
            cv2.putText(right_img, text, (right_img.shape[1] - text_size[0]	- 5, right_img.shape[0] - text_size[1]), fontFace=cv2.FONT_HERSHEY_SIMPLEX,	fontScale=0.5, color=(255, 255,	255), thickness=1)

            cv2.imshow('left', left_img)
            cv2.imshow('right', right_img)

            #cv2.imshow('left_undistorted', left_img_undistorted)
            #cv2.imshow('right_undistorted', right_img_undistorted)

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
    parser.add_argument("--calibration_file")
    parser.add_argument("--sensor_width", type=float, default=3.68)  # in mm
    parser.add_argument("--sensor_height", type=float, default=2.76) # in mm
    parser.add_argument("--focal_length", type=float, default=3.04)  # in mm
    parser.add_argument("--right_camera_shift", type=float, default=-100)  # in mm
    parser.add_argument("--frame_width", type=int, default=640)
    parser.add_argument("--frame_height", type=int, default=480)
    parser.add_argument("--camera_x", type=int, default=3294)
    parser.add_argument("--camera_y", type=int, default=-55)
    parser.add_argument("--camera_z", type=int, default=15)
    parser.add_argument("--camera_anglex", type=float, default=15.5)
    parser.add_argument("--camera_angley", type=float, default=-2)
    parser.add_argument("--camera_anglez", type=float, default=0)
    parser.add_argument("--display", action="store_true", default=True)
    parser.add_argument("--no_display", action="store_false", dest='display')
    parser.add_argument("--tv_left", type=int, default=2632)
    parser.add_argument("--tv_right", type=int, default=4020)
    parser.add_argument("--mqtt_name", default='tm')
    parser.add_argument("--mqtt_host", default='192.168.22.20')
    parser.add_argument("--mqtt_port", type=int, default=1883)
    parser.add_argument("--predictor_path", default='shape_predictor_68_face_landmarks.dat')
    parser.add_argument("--face_rec_model_path", default='dlib_face_recognition_resnet_model_v1.dat')    
    parser.add_argument("--dlib_upscale", type=int, default=1)
    parser.add_argument("--faces_dir", default="faces")
    parser.add_argument("--faces_url", default="http://192.168.22.20:8000/")
    parser.add_argument("--fps_frames", type=int, default=100)
    parser.add_argument("--face_nn_url", default='http://localhost:5000/')
    parser.add_argument("--left_video_source", choices=['camera', 'url'], default='url')
    parser.add_argument("--left_video_url", default='http://rtv2b.local:5000/?width=640&height=480&framerate=40&drc=high&hflip=&nopreview=')
    parser.add_argument("--left_video_camera", type=int, default=3)
    parser.add_argument("--right_video_source", choices=['camera', 'url'], default='url')
    parser.add_argument("--right_video_url", default='http://rtv2.local:5000/?width=640&height=480&framerate=40&drc=high&hflip=&nopreview=')
    parser.add_argument("--right_video_camera", type=int, default=1)
    parser.add_argument("--profile_type", choices=['profile', 'pprofile'], default='pprofile')
    parser.add_argument("--profile")
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
    target = capture
    if args.profile:
        if args.profile_type == 'pprofile':
            target = capture_pprofile
        elif args.profile_type == 'profile':
            target = capture_profile
        else:
            assert False
    cl = Process(name='capture_left', target=target , args=(left_frame, done, args.left_video_source, args.left_video_camera, args.left_video_url, args))
    cl.start()

    cr = Process(name='capture_right', target=target , args=(right_frame, done, args.right_video_source, args.right_video_camera, args.right_video_url, args))
    cr.start()

    # launch face detection process
    target = processing
    if args.profile:
        if args.profile_type == 'pprofile':
            target = processing_pprofile
        elif args.profile_type == 'profile':
            target = processing_profile
        else:
            assert False
    p = Process(name='processing', target=target, args=(left_frame, right_frame, done, args))
    p.start()

    # wait for processes to finish
    p.join()
    cl.join()
    cr.join()
