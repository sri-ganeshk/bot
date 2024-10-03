import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

// Replace with your bot token
const bot = new TelegramBot('7851794722:AAF4qiKKEGZ0hk6i8ZbTDFNUimIYcz2cgtM', { polling: true });

// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    // Send a welcome message and explain how to use the /get command
    bot.sendMessage(chatId, `Welcome! To check your attendance, use the following format:\n\n/get <student_id> <password>\n\nFor example:\n/get 22l31a0596 password`);
});

// Handle /get command with student ID and password
bot.onText(/\/get (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userInput = match[1]; // Extract the part after /get (student ID and password)

    // Split the input into student ID and password
    const [studentId, password] = userInput.split(' ');

    if (!studentId || !password) {
        bot.sendMessage(chatId, "Please provide both student ID and password in the format: /get <student_id> <password>");
        return;
    }

    // Make a request to the Flask API with student ID and password
    axios.get('http://localhost:3000/attendance', {
        params: {
            student_id: studentId,
            password: password
        }
    })
    .then(response => {
        const data = response.data;

        if (data.error) {
            bot.sendMessage(chatId, `Error: ${data.error}`);
            return;
        }

        const rollNumber = data.roll_number;
        const totalInfo = data.total_info;
        const subjectwiseSummary = data.subjectwise_summary;
        const attendanceSummary = data.attendance_summary;

        let message = `Hi, Roll Number: ${rollNumber}\n\nSubject-wise Attendance:\n`;

        // Append subject-wise attendance
        subjectwiseSummary.forEach(subject => {
            message += `${subject.subject_name}: ${subject.attended_held} (${subject.percentage}%)\n`;
        });

        // Append total attendance
        message += `\nTotal: ${totalInfo.total_attended}/${totalInfo.total_held} (${totalInfo.total_percentage}%)\n`;

        // Append today's attendance details if available
        if (attendanceSummary.length > 0 && attendanceSummary[0].subject) {
            message += `\nToday's Attendance:\n`;
            attendanceSummary.forEach(attendance => {
                message += `${attendance.subject}: ${attendance.attendance_today}\n`;
            });
        } else {
            message += `\n${attendanceSummary[0].message}\n`;
        }

        // Append hours to skip or needed to attend
        if (totalInfo.total_percentage < 75) {
            message += `\nYou need to attend ${totalInfo.additional_hours_needed} more hours to reach 75%.`;
        } else {
            message += `\nYou can skip ${totalInfo.hours_can_skip} hours and still maintain above 75%.`;
        }

        // Send the final formatted message
        bot.sendMessage(chatId, message);

    })
    .catch(error => {
        bot.sendMessage(chatId, "Failed to fetch attendance data.");
        
    });
});
