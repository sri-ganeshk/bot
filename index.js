import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

// Replace with your bot token
const bot = new TelegramBot('YOUR_BOT_TOKEN_HERE', { polling: true });

// Helper function to build the attendance message text
const buildAttendanceMessage = (data) => {
  const rollNumber = data.roll_number;
  const totalInfo = data.total_info;
  const subjectwiseSummary = data.subjectwise_summary;
  const attendanceSummary = data.attendance_summary;

  let message = `Hi, Roll Number: ${rollNumber}\n\nSubject-wise Attendance:\n`;

  subjectwiseSummary.forEach(subject => {
    message += `${subject.subject_name}: ${subject.attended_held} (${subject.percentage}%)\n`;
  });

  message += `\nTotal: ${totalInfo.total_attended}/${totalInfo.total_held} (${totalInfo.total_percentage}%)\n`;

  if (attendanceSummary.length > 0 && attendanceSummary[0].subject) {
    message += `\nToday's Attendance:\n`;
    attendanceSummary.forEach(attendance => {
      message += `${attendance.subject}: ${attendance.attendance_today}\n`;
    });
  } else {
    message += `\n${attendanceSummary[0].message}\n`;
  }

  if (totalInfo.total_percentage < 75) {
    message += `\nYou need to attend ${totalInfo.additional_hours_needed} more hours to reach 75%.`;
  } else {
    message += `\nYou can skip ${totalInfo.hours_can_skip} hours and still maintain above 75%.`;
  }

  return message;
};

// Inline function to update attendance data
const updateAttendance = (chatId, messageId, studentId, password) => {
  axios
    .get('https://a0qna69x15.execute-api.ap-southeast-2.amazonaws.com/dev/attendance', {
      params: { student_id: studentId, password: password }
    })
    .then(response => {
      const data = response.data;
      if (data.error) {
        bot
          .editMessageText(`Error: ${data.error}`, { chat_id: chatId, message_id: messageId })
          .catch(err => console.error(err));
        return;
      }

      const message = buildAttendanceMessage(data);
      // Re-attach the inline keyboard button for further updates
      bot
        .editMessageText(message, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [
                { 
                  text: 'Update Attendance', 
                  // Use shortened keys to keep the data small (within 64 bytes)
                  callback_data: JSON.stringify({ a: 'u', s: studentId, p: password })
                }
              ]
            ]
          }
        })
        .catch(err => {
          // If the error is because the message is not modified, ignore it.
          if (
            err.response &&
            err.response.body &&
            err.response.body.description &&
            err.response.body.description.includes('message is not modified')
          ) {
            // Do nothing since the message hasn't changed
            return;
          }
          console.error(err);
        });
    })
    .catch(error => {
      bot
        .editMessageText("Failed to fetch attendance data.", { chat_id: chatId, message_id: messageId })
        .catch(err => console.error(err));
    });
};

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `Welcome! To check your attendance, use the following format:\n\n/get <student_id> <password>\n\nFor example:\n/get 22l31a0596 password`
  );
});

// Handle /get command with student ID and password
bot.onText(/\/get (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userInput = match[1];

  // Split the input into student ID and password
  const [studentId, password] = userInput.split(' ');

  if (!studentId || !password) {
    bot.sendMessage(chatId, "Please provide both student ID and password in the format: /get <student_id> <password>");
    return;
  }

  axios
    .get('https://a0qna69x15.execute-api.ap-southeast-2.amazonaws.com/dev/attendance', {
      params: { student_id: studentId, password: password }
    })
    .then(response => {
      const data = response.data;
      if (data.error) {
        bot.sendMessage(chatId, `Error: ${data.error}`);
        return;
      }

      const message = buildAttendanceMessage(data);
      // Send the message along with an inline button to update attendance
      bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [
            [
              { 
                text: 'Update Attendance', 
                callback_data: JSON.stringify({ a: 'u', s: studentId, p: password })
              }
            ]
          ]
        }
      });
    })
    .catch(error => {
      bot.sendMessage(chatId, "Failed to fetch attendance data.");
    });
});

// Handle callback queries from inline buttons
bot.on('callback_query', (callbackQuery) => {
  const { message } = callbackQuery;
  let data;

  try {
    data = JSON.parse(callbackQuery.data);
  } catch (e) {
    bot.answerCallbackQuery(callbackQuery.id, { text: "Invalid callback data." });
    return;
  }

  // Check the shortened key for the action
  if (data.a === 'u') {
    const studentId = data.s;
    const password = data.p;
    // Inform the user that an update is in progress
    bot.answerCallbackQuery(callbackQuery.id, { text: "Updating attendance..." });
    // Call the inline function to update the attendance
    updateAttendance(message.chat.id, message.message_id, studentId, password);
  }
});
