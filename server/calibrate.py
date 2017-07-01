import argparse
from glob import glob
import numpy as np
import os
import cv2

def get_camera_matrix(imageWidth, imageHeight, sensorWidth, sensorHeight, focalLength):
    fx = imageWidth * focalLength / sensorWidth # in px
    fy = imageHeight * focalLength / sensorHeight # in px
    cx = imageWidth / 2 # in px
    cy = imageHeight / 2 # in px
    return np.array([[fx, 0, cx], [0, fy, cy], [0, 0, 1]], dtype=np.float32)

parser = argparse.ArgumentParser()
parser.add_argument("input_dir")
parser.add_argument("calibration_file")
parser.add_argument("--debug_dir")
parser.add_argument("--pattern", choices=['chess', 'circles'], default='chess')
parser.add_argument("--square_size", type=float, default=45)
parser.add_argument("--rows", type=int, default=6)
parser.add_argument("--cols", type=int, default=9)
parser.add_argument("--frame_width", type=int, default=640)
parser.add_argument("--frame_height", type=int, default=480)
parser.add_argument("--sensor_width", type=float, default=3.68)  # in mm
parser.add_argument("--sensor_height", type=float, default=2.76) # in mm
parser.add_argument("--focal_length", type=float, default=3.04)  # in mm
args = parser.parse_args()

pattern_size = (args.cols, args.rows)
pattern_points = np.zeros((np.prod(pattern_size), 3), np.float32)
pattern_points[:, :2] = np.indices(pattern_size).T.reshape(-1, 2)
pattern_points *= args.square_size

obj_points = []
img_points = []
img_files = []

for img_file in sorted(glob(os.path.join(args.input_dir, '*.jpg'))):
    print img_file,
    img = cv2.imread(img_file, cv2.IMREAD_GRAYSCALE)
    assert img is not None
    
    img = cv2.resize(img, (args.frame_width, args.frame_height))

    if args.pattern == 'chess':
        found, corners = cv2.findChessboardCorners(img, pattern_size)
        if found:
            term = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_COUNT, 50, 0.001)
            cv2.cornerSubPix(img, corners, (5, 5), (-1, -1), term)
    elif args.pattern == 'circles':
        found, corners = cv2.findCirclesGrid(img, pattern_size, flags=cv2.CALIB_CB_ASYMMETRIC_GRID)
    else:
        assert False
    if found:
        img_points.append(corners.reshape(-1, 2))
        obj_points.append(pattern_points)
        img_files.append(img_file)
        print "found"

        if args.debug_dir:
            cv2.drawChessboardCorners(img, pattern_size, corners, found)
            cv2.imwrite(os.path.join(args.debug_dir, os.path.basename(img_file)), img)
    else:
        print "not found"

camera_matrix = get_camera_matrix(args.frame_width, args.frame_height, args.sensor_width, args.sensor_height, args.focal_length)
print "camera_matrix before:", camera_matrix
rms, camera_matrix, dist_coefs, rvecs, tvecs = cv2.calibrateCamera(obj_points, img_points, (args.frame_width, args.frame_height), camera_matrix, None, flags=cv2.CALIB_USE_INTRINSIC_GUESS)
#dist_coefs = np.zeros((5,))
#rms = None

print "RMS:", rms
print "camera_matrix:", camera_matrix
print "dist_coefs:", dist_coefs
print "image_size:", (args.frame_width, args.frame_height)

proj_points = []
for obj_point, rvec, tvec in zip(obj_points, rvecs, tvecs):
    proj_point, jacobian = cv2.projectPoints(obj_point, rvec, tvec, camera_matrix, dist_coefs)
    proj_points.append(proj_point[:, 0])

print "RMS from reprojected points:", np.mean(np.linalg.norm(np.array(img_points) - np.array(proj_points), axis=-1))

np.savez(args.calibration_file, rms=rms, camera_matrix=camera_matrix, dist_coefs=dist_coefs, image_width=args.frame_width, image_height=args.frame_height, 
        img_points=img_points, rotation_vectors=rvecs, translation_vectors=tvecs, proj_points=proj_points, img_files=img_files)
