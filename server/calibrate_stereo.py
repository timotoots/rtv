import argparse
from glob import glob
import numpy as np
import os
import cv2

parser = argparse.ArgumentParser()
parser.add_argument("input_dir")
parser.add_argument("stereo_calibration_file")
parser.add_argument("left_calibration_file")
parser.add_argument("right_calibration_file")
parser.add_argument("--debug_dir")
parser.add_argument("--square_size", type=float, default=22)
parser.add_argument("--rows", type=int, default=7)
parser.add_argument("--cols", type=int, default=9)
parser.add_argument("--frame_width", type=int, default=640)
parser.add_argument("--frame_height", type=int, default=480)
args = parser.parse_args()

left_calibration = np.load(args.left_calibration_file)
left_camera_matrix = left_calibration['camera_matrix']
left_dist_coefs = left_calibration['dist_coefs']
print "left RMS:", left_calibration['rms']

right_calibration = np.load(args.right_calibration_file)
right_camera_matrix = right_calibration['camera_matrix']
right_dist_coefs = right_calibration['dist_coefs']
print "right RMS:", right_calibration['rms']

pattern_size = (args.cols, args.rows)
pattern_points = np.zeros((np.prod(pattern_size), 3), np.float32)
pattern_points[:, :2] = np.indices(pattern_size).T.reshape(-1, 2)
pattern_points *= args.square_size

obj_points = []
left_points = []
right_points = []

left_files = sorted(glob(os.path.join(args.input_dir, 'left*.jpg')))
right_files = sorted(glob(os.path.join(args.input_dir, 'right*.jpg')))

for left_file, right_file in zip(left_files, right_files):
    print left_file, right_file,
    left_img = cv2.imread(left_file, cv2.IMREAD_GRAYSCALE)
    right_img = cv2.imread(right_file, cv2.IMREAD_GRAYSCALE)
    
    left_img = cv2.resize(left_img, (args.frame_width, args.frame_height))
    right_img = cv2.resize(right_img, (args.frame_width, args.frame_height))

    left_found, left_corners = cv2.findChessboardCorners(left_img, pattern_size)
    right_found, right_corners = cv2.findChessboardCorners(right_img, pattern_size)
    if left_found and right_found:
        term = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_COUNT, 30, 0.1)
        cv2.cornerSubPix(left_img, left_corners, (5, 5), (-1, -1), term)
        cv2.cornerSubPix(right_img, right_corners, (5, 5), (-1, -1), term)

        left_points.append(left_corners.reshape(-1, 2))
        right_points.append(right_corners.reshape(-1, 2))
        obj_points.append(pattern_points)
        print "found"

        if args.debug_dir:
            cv2.drawChessboardCorners(left_img, pattern_size, left_corners, left_found)
            cv2.imwrite(os.path.join(args.debug_dir, os.path.basename(left_file)), left_img)
            cv2.drawChessboardCorners(right_img, pattern_size, right_corners, right_found)
            cv2.imwrite(os.path.join(args.debug_dir, os.path.basename(right_file)), right_img)
    else:
        print "not found"

print "left_camera_matrix:", left_camera_matrix
print "right_camera_matrix:", right_camera_matrix

ret, left_camera_matrix_new, left_dist_coefs_new, right_camera_matrix_new, right_dist_coefs_new, R, T, E, F = \
    cv2.stereoCalibrate(obj_points, left_points, right_points, imageSize=(args.frame_width, args.frame_height), cameraMatrix1=left_camera_matrix, distCoeffs1=left_dist_coefs, cameraMatrix2=right_camera_matrix, distCoeffs2=right_dist_coefs, flags=cv2.CALIB_FIX_INTRINSIC)
assert ret

print "left_camera_matrix_new:", left_camera_matrix_new
print "right_camera_matrix_new:", right_camera_matrix_new

RL, RR, PL, PR, Q, ROIL, ROIR = cv2.stereoRectify(cameraMatrix1=left_camera_matrix_new, cameraMatrix2=right_camera_matrix_new, distCoeffs1=left_dist_coefs_new, distCoeffs2=right_dist_coefs_new, imageSize=(args.frame_width, args.frame_height), R=R, T=T)

np.savez(args.stereo_calibration_file, R=R, T=T, E=E, F=F, RL=RL, RR=RR, PL=PL, PR=PR, Q=Q)

print "R:", R.shape
print "T:", T.shape, T
print "E:", E.shape
print "F:", F.shape
print "RL:", RL.shape
print "RR:", RR.shape
print "PL:", PL.shape
print "PR:", PR.shape
print "Q:", Q.shape
