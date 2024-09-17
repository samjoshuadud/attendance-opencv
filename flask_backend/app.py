from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import face_recognition
import numpy as np
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

known_face_encodings = []
known_face_names = []
attendance_records = {}

SKIP_FRAMES = 3
frame_count = 0

def load_known_faces():
    known_faces_path = 'dataset/' #change to  flask_backend/dataset/ if run here in vs
    if not os.path.exists(known_faces_path):
        raise FileNotFoundError(f"Dataset directory {known_faces_path} does not exist.")
    
    for person_folder in os.listdir(known_faces_path):
        person_folder_path = os.path.join(known_faces_path, person_folder)
        
        if os.path.isdir(person_folder_path):
            for image_file in os.listdir(person_folder_path):
                if image_file.endswith(('.jpg', '.jpeg', '.png')):
                    image_path = os.path.join(person_folder_path, image_file)
                    try:
                        image = face_recognition.load_image_file(image_path)
                        encodings = face_recognition.face_encodings(image)
                        # Add all found face encodings for this person
                        for encoding in encodings:
                            known_face_encodings.append(encoding)
                            known_face_names.append(person_folder)  # Use folder name as person's name
                    except Exception as e:
                        print(f"Error processing file {image_path}: {e}")

load_known_faces()


@app.route('/api/detect-face', methods=['POST'])
def detect_face():
    global frame_count
    if 'image' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        image = np.asarray(bytearray(file.read()), dtype=np.uint8)
        image = cv2.imdecode(image, cv2.IMREAD_COLOR)
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Only process every SKIP_FRAMES frame
        frame_count += 1
        if frame_count % SKIP_FRAMES != 0:
            return jsonify({
                'attendanceRecords': [{"name": name, "time": record["time"]} for name, record in attendance_records.items()],
                'faceLocations': [],
                'names': []
            })

        # Reduce the image size for faster processing
        small_frame = cv2.resize(rgb_image, (0, 0), fx=0.25, fy=0.25)

        face_locations = face_recognition.face_locations(small_frame)
        face_encodings = face_recognition.face_encodings(small_frame, face_locations)

        names = []
        for face_encoding in face_encodings:
            matches = face_recognition.compare_faces(known_face_encodings, face_encoding)
            name = "Unknown"

            if True in matches:
                first_match_index = matches.index(True)
                name = known_face_names[first_match_index]

            names.append(name)
            
            if name not in attendance_records:
                current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                attendance_records[name] = {"time": current_time}

        # Scale back up face locations since the frame we detected in was scaled to 1/4 size
        face_locations = [(top*4, right*4, bottom*4, left*4) for (top, right, bottom, left) in face_locations]

        return jsonify({
            'attendanceRecords': [{"name": name, "time": record["time"]} for name, record in attendance_records.items()],
            'faceLocations': face_locations,
            'names': names
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reset-attendance', methods=['POST'])
def reset_attendance():
    global attendance_records
    attendance_records = {}
    return jsonify({'message': 'Attendance records reset successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True)