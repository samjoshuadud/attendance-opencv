import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const FaceAttendance = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isChecking, setIsChecking] = useState(false);
  const checkingIntervalRef = useRef(null);

  useEffect(() => {
    startCamera();

    return () => {
      if (checkingIntervalRef.current) {
        clearInterval(checkingIntervalRef.current);
      }
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing webcam:', error);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    const tracks = stream?.getTracks();
    tracks?.forEach(track => track.stop());
  };

  const startAttendanceCheck = () => {
    setIsChecking(true);
    checkingIntervalRef.current = setInterval(detectFaces, 1000); // Check every second
  };

  const stopAttendanceCheck = () => {
    setIsChecking(false);
    if (checkingIntervalRef.current) {
      clearInterval(checkingIntervalRef.current);
    }
  };

  const detectFaces = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
  
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
    canvas.toBlob(blob => {
      const formData = new FormData();
      formData.append('image', blob, 'capture.jpg');
  
      axios.post('/api/detect-face', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
        .then(response => {
          console.log('Response:', response.data);
          setAttendanceRecords(response.data.attendanceRecords || []);
          drawBoxesOnCanvas(response.data.faceLocations, response.data.names);
        })
        .catch(error => {
          console.error('Error during face detection:', error.response || error);
        });
    }, 'image/jpeg', 0.8);  // Reduced JPEG quality for smaller file size
  };

  const drawBoxesOnCanvas = (faceLocations, names) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#00FF00';
    context.lineWidth = 2;
    context.font = '16px Arial';
    context.fillStyle = '#00FF00';

    faceLocations.forEach((location, index) => {
      const [top, right, bottom, left] = location;
      context.beginPath();
      context.rect(left, top, right - left, bottom - top);
      context.stroke();

      const name = names[index] || 'Unknown';
      context.fillText(name, left, top - 5);
    });
  };

  const resetAttendance = () => {
    axios.post('/api/reset-attendance')
      .then(() => {
        setAttendanceRecords([]);
        console.log('Attendance reset successfully');
      })
      .catch(error => {
        console.error('Error resetting attendance:', error);
      });
  };

  return (
    <div className="p-6">
      <header className="bg-gray-800 text-white p-4 text-center">
        <h1 className="text-2xl font-bold">Face Attendance System</h1>
      </header>

      <main className="mt-6">
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Face Detection</h2>
          <div className="flex flex-col items-center">
            <div className="relative">
              <video ref={videoRef} className="border rounded-lg" width="640" height="480" autoPlay muted></video>
              <canvas ref={canvasRef} className="absolute top-0 left-0" width="640" height="480"></canvas>
            </div>
            <div className="mt-4 space-x-4">
              {!isChecking ? (
                <button
                  onClick={startAttendanceCheck}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600"
                >
                  Start Attendance Check
                </button>
              ) : (
                <button
                  onClick={stopAttendanceCheck}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600"
                >
                  Stop Checking Attendance
                </button>
              )}
              <button
                onClick={resetAttendance}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg shadow hover:bg-yellow-600"
              >
                Reset Attendance
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Attendance Records</h2>
          <table className="min-w-full bg-white border border-gray-300 rounded-lg shadow">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="py-2 px-4 text-left text-gray-600">Name</th>
                <th className="py-2 px-4 text-left text-gray-600">Time</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords.map((record, index) => (
                <tr key={index} className="border-b">
                  <td className="py-2 px-4 text-gray-700">{record.name}</td>
                  <td className="py-2 px-4 text-gray-700">{record.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
};

export default FaceAttendance;
