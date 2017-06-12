import os
import cv2
import cv2gpu

cascade_file_cpu = ('haarcascade_frontalface_default.xml')
cascade_file_gpu = ('haarcascade_frontalface_default_cuda.xml')

def main():

    if cv2gpu.is_cuda_compatible():
        cv2gpu.init_gpu_detector(cascade_file_gpu)
    else:
        cv2gpu.init_cpu_detector(cascade_file_cpu)
    
    cap = cv2.VideoCapture("http://192.168.22.22:5000")
    faces = cv2gpu.find_faces(cap)
    image = cv2.imread(cap)
    for (x, y, w, h) in faces:
        cv2.rectangle(image, (x, y), (x+w, y+h), (0, 255, 0), 2)
        cv2.imshow('faces', image)
        cv2.waitKey(0)

if __name__ == '__main__':
main()

