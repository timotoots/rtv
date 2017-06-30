import argparse
from glob import glob
import numpy as np
import os
import cv2

parser = argparse.ArgumentParser()
parser.add_argument("input_dir")
parser.add_argument("left_calibration_file")
parser.add_argument("right_calibration_file")
parser.add_argument("stereo_calibration_file")
parser.add_argument("--debug_dir")
parser.add_argument("--square_size", type=float, default=45)
parser.add_argument("--rows", type=int, default=6)
parser.add_argument("--cols", type=int, default=9)
parser.add_argument("--frame_width", type=int, default=640)
parser.add_argument("--frame_height", type=int, default=480)
args = parser.parse_args()

left_calibration = np.load(args.left_calibration_file)
left_camera_matrix = left_calibration['camera_matrix']
left_dist_coefs = left_calibration['dist_coefs']
# convert camera matrix for new resolution
left_camera_matrix[0] *= args.frame_width / left_calibration['image_width']
left_camera_matrix[1] *= args.frame_height / left_calibration['image_height']
# TODO: do we need to convert dist coeff matrix as well?
print "left RMS:", left_calibration['rms']

right_calibration = np.load(args.right_calibration_file)
right_camera_matrix = right_calibration['camera_matrix']
right_dist_coefs = right_calibration['dist_coefs']
# convert camera matrix for new resolution
right_camera_matrix[0] *= args.frame_width / right_calibration['image_width']
right_camera_matrix[1] *= args.frame_height / right_calibration['image_height']
# TODO: do we need to convert dist coeff matrix as well?
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

    left_found, left_corners = cv2.findChessboardCorners(left_img, pattern_size, flags=cv2.CALIB_CB_ADAPTIVE_THRESH + cv2.CALIB_CB_NORMALIZE_IMAGE)
    right_found, right_corners = cv2.findChessboardCorners(right_img, pattern_size, flags=cv2.CALIB_CB_ADAPTIVE_THRESH + cv2.CALIB_CB_NORMALIZE_IMAGE)
    if left_found and right_found:
        term = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_COUNT, 50, 0.001)
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

print "left_camera_matrix before:", left_camera_matrix
print "right_camera_matrix before:", right_camera_matrix

ret, left_camera_matrix, left_dist_coefs, right_camera_matrix, right_dist_coefs, stereo_rotation_matrix, stereo_trans_matrix, essential_matrix, fundamental_matrix = \
    cv2.stereoCalibrate(obj_points, left_points, right_points, imageSize=(args.frame_width, args.frame_height), cameraMatrix1=left_camera_matrix, distCoeffs1=left_dist_coefs, cameraMatrix2=right_camera_matrix, distCoeffs2=right_dist_coefs, flags=cv2.CALIB_FIX_INTRINSIC)
assert ret

print "left_camera_matrix after:", left_camera_matrix
print "right_camera_matrix after:", right_camera_matrix

left_rotation_matrix, right_rotation_matrix, left_proj_matrix, right_proj_matrix, depth_mapping_matrix, ROIL, ROIR = \
    cv2.stereoRectify(cameraMatrix1=left_camera_matrix, cameraMatrix2=right_camera_matrix, distCoeffs1=left_dist_coefs, distCoeffs2=right_dist_coefs, imageSize=(args.frame_width, args.frame_height), R=stereo_rotation_matrix, T=stereo_trans_matrix)

reconst_points = []
for left_corners, right_corners in zip(left_points, right_points):
    left_corners_undistorted = cv2.undistortPoints(left_corners[np.newaxis], left_camera_matrix, left_dist_coefs, R=left_rotation_matrix, P=left_proj_matrix)[0]
    right_corners_undistorted = cv2.undistortPoints(right_corners[np.newaxis], right_camera_matrix, right_dist_coefs, R=right_rotation_matrix, P=right_proj_matrix)[0]
    reconst_point = cv2.triangulatePoints(left_proj_matrix, right_proj_matrix, left_corners_undistorted.T, right_corners_undistorted.T)
    reconst_point /= reconst_point[3] # convert to homogeneous coordinates
    reconst_point = reconst_point[:3] # get rid of ones
    reconst_point = reconst_point.T   # coordinates as second dimension
    reconst_points.append(reconst_point)

print "RMS from reprojected points:", np.mean(np.linalg.norm(np.array(obj_points) - np.array(reconst_points), axis=-1))

np.savez(args.stereo_calibration_file, 
    left_camera_matrix=left_camera_matrix,
    right_camera_matrix=right_camera_matrix,
    left_dist_coefs=left_dist_coefs,
    right_dist_coefs=right_dist_coefs,
    stereo_rotation_matrix=stereo_rotation_matrix, 
    stereo_trans_matrix=stereo_trans_matrix, 
    essential_matrix=essential_matrix, 
    fundamental_matrix=fundamental_matrix, 
    left_rotation_matrix=left_rotation_matrix, 
    right_rotation_matrix=right_rotation_matrix, 
    left_proj_matrix=left_proj_matrix, 
    right_proj_matrix=right_proj_matrix, 
    depth_mapping_matrix=depth_mapping_matrix,
    image_width=args.frame_width, 
    image_height=args.frame_height,
    left_points=left_points,
    right_points=right_points,
    obj_points=obj_points,
    reconst_points=reconst_points)

print "stereo_rotation_matrix:", stereo_rotation_matrix.shape
#print stereo_rotation_matrix
print "stereo_trans_matrix:", stereo_trans_matrix.shape
print stereo_trans_matrix
print "essential_matrix:", essential_matrix.shape
print "fundamental_matrix:", fundamental_matrix.shape
print "left_rotation_matrix:", left_rotation_matrix.shape
print "right_rotation_matrix:", right_rotation_matrix.shape
print "left_proj_matrix:", left_proj_matrix.shape
#print left_proj_matrix
print "right_proj_matrix:", right_proj_matrix.shape
#print right_proj_matrix
print "distance between cameras on a common plane:", right_proj_matrix[0, 3] / right_proj_matrix[0, 0]
print "depth_mapping_matrix:", depth_mapping_matrix.shape
print "image_size:", (args.frame_width, args.frame_height)
