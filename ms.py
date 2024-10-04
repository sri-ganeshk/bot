from flask import Flask, request, jsonify
from test import fetch_attendance  

app = Flask(__name__)

@app.route('/attendance', methods=['GET'])
def get_attendance():
    student_id = request.args.get('student_id')
    password = request.args.get('password')
    
    if not student_id or not password:
        return jsonify({"error": "Missing student_id or password"}), 400

    try:
        attendance_data = fetch_attendance(student_id, password)
        if not attendance_data:
            return jsonify({"error": "Could not fetch attendance"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(attendance_data)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=3000)
