import cv2

faceCascade = cv2.CascadeClassifier("haarcascade_frontalface_default.xml")
eyeCascade = cv2.CascadeClassifier("haarcascade_eye.xml")


def main():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        return -1

    cap.set(3, 640)  # Width
    cap.set(4, 480)  # Height

    while True:
        ret, img = cap.read()
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = faceCascade.detectMultiScale(
            gray,
            scaleFactor=1.05,
            minNeighbors=10,
            minSize=(20, 20)
        )

        # Search smile only on face which is already detected
        for (x, y, w, h) in faces:
            print(x,y,w,h)
            cv2.rectangle(img, (x, y), (x + w, y + h), (240, 105, 70), 2)
            roi_gray = gray[y:y + (y+h)/2, x:x + w]
            roi_color = img[y:y + h, x:x + w]

            eyes = eyeCascade.detectMultiScale(
                roi_gray,
                minNeighbors=12
            )

            # Draw a rectangle around the smile
            for (sx, sy, sw, sh) in eyes:
                cv2.rectangle(roi_color, (sx, sy), (sx + sw, sy + sh), (70, 180, 240), 2)

        cv2.imwrite("SmileyFace.bmp", img)
        cv2.imshow('Smile Detector', img)
        k = cv2.waitKey(30) & 0xFF
        if k == 27:  # Escape key
            break

    cap.release()
    cv2.destroyAllWindows()


main()
