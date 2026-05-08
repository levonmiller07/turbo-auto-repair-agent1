const express = require('express');
const bodyParser = require('body-parser');
const { DateTime } = require('luxon');
const fs = require('fs');
const { execSync } = require('child_process');

const twilio = require('twilio');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const DB_FILE = './db.json';
const OWNER_PHONE = '(225) 930-5472';

// Initialize Twilio client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const TWILIO_NUMBER = '(833) 750-1468'; // User's Twilio Number

// Helper to load/save mock database
function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    return { appointments: [], leads: [], tasks: [] };
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Business Hours Check
function isWithinBusinessHours(dt) {
  const day = dt.weekday; // 1-7 (Mon-Sun)
  const hour = dt.hour;
  const minute = dt.minute;

  if (day >= 1 && day <= 5) { // Mon-Fri
    return hour >= 8 && (hour < 18 || (hour === 18 && minute === 0));
  } else if (day === 6) { // Sat
    return hour >= 8 && (hour < 13 || (hour === 13 && minute === 0));
  }
  return false; // Sun
}

// Actual SMS sender using Twilio
async function sendSms(to, message) {
  console.log(`[SMS Attempt to ${to}]: ${message}`);
  try {
    await twilioClient.messages.create({
      body: message,
      from: TWILIO_NUMBER,
      to: to
    });
    console.log(`[SMS Sent to ${to}]`);
  } catch (e) {
    console.error('Failed to send SMS via Twilio:', e.message);
  }
}

// Tool Handlers
const tools = {
  end_call: () => {
    return { status: 'success', message: 'Ending call.', endCall: true };
  },
  check_availability: (args) => {
    const { date } = args;
    const requestedDate = DateTime.fromISO(date);
    
    if (requestedDate.weekday === 7) {
      return { status: 'closed', message: 'We are closed on Sundays.' };
    }

    // In a real app, check Google Calendar for conflicts here
    // For this demo, we'll return some mock slots within hours
    const slots = [];
    let startHour = 8;
    let endHour = requestedDate.weekday === 6 ? 13 : 18;

    for (let h = startHour; h < endHour; h++) {
      slots.push(`${h}:00`, `${h}:30`);
    }
    
    return { status: 'available', slots };
  },

  book_appointment: (args) => {
    const { date, time, service, name, phone, vehicle } = args;
    const dt = DateTime.fromISO(`${date}T${time}`);

    if (!isWithinBusinessHours(dt)) {
      return { status: 'error', message: 'Requested time is outside of business hours.' };
    }

    const db = loadDb();
    const appointment = {
      id: Date.now().toString(),
      date,
      time,
      service,
      name,
      phone,
      vehicle,
      createdAt: DateTime.now().toISO()
    };
    db.appointments.push(appointment);

    // Schedule 24h reminder
    const reminderTime = dt.minus({ hours: 24 }).toISO();
    db.tasks.push({
      type: 'reminder',
      target: phone,
      time: reminderTime,
      message: `Turbo Auto Repair: Reminder for your ${service} appointment tomorrow at ${time}.`
    });

    // Schedule 1-day follow-up (Google Review)
    const followUpTime = dt.plus({ days: 1, hours: 2 }).toISO();
    db.tasks.push({
      type: 'followup',
      target: phone,
      time: followUpTime,
      message: `Hi ${name}, thank you for choosing Turbo Auto Repair for your ${service}! We'd love to hear about your experience. Please leave us a review here: https://g.page/turbo-auto-repair/review`
    });

    // Schedule 3-month maintenance reminder
    const maintenanceTime = dt.plus({ months: 3 }).toISO();
    db.tasks.push({
      type: 'maintenance',
      target: phone,
      time: maintenanceTime,
      message: `Hi ${name}, it's been 3 months since your last visit to Turbo Auto Repair. Time for a routine check-up or oil change? Book here: [Link]`
    });

    saveDb(db);

    // Call Google Calendar CLI to insert event
    try {
      const summary = `${service} - ${name} (${vehicle})`;
      const start = dt.toISO();
      const end = dt.plus({ hours: 1 }).toISO();
      // execSync(`npx gws calendar +insert --summary "${summary}" --start "${start}" --end "${end}"`);
    } catch (e) {
      console.error('Failed to book in Google Calendar:', e.message);
    }

    // Send confirmation SMS
    sendSms(phone, `Turbo Auto Repair: Your appointment for ${service} on ${date} at ${time} is confirmed!`);

    return { status: 'success', message: 'Appointment booked successfully.' };
  },

  escalate_issue: (args) => {
    const { name, phone, details } = args;
    sendSms(OWNER_PHONE, `URGENT ESCALATION: ${name} (${phone}) reports: ${details}`);
    return { status: 'success', message: 'The shop owner has been notified.' };
  }
};

// Vapi Webhook Endpoint
app.post('/api/vapi/tools', (req, res) => {
  const { message } = req.body;
  if (message.type === 'tool-call') {
    const toolCall = message.toolCalls[0];
    const handler = tools[toolCall.function.name];
    if (handler) {
      const result = handler(JSON.parse(toolCall.function.arguments));
      return res.json(result);
    }
  }
  res.status(404).json({ error: 'Tool not found' });
});

// Lead Capture Logic
app.post('/api/vapi/status', (req, res) => {
  const { message } = req.body;
  if (message.type === 'end-of-call-report') {
    const db = loadDb();
    const customerPhone = message.call.customer.number;
    
    // Check if an appointment was made in this call
    // (Simplified logic: check if phone is in appointments created recently)
    const recentlyBooked = db.appointments.some(a => a.phone === customerPhone && DateTime.fromISO(a.createdAt) > DateTime.now().minus({ minutes: 30 }));

    if (!recentlyBooked) {
      // Capture as lead
      db.leads.push({
        phone: customerPhone,
        capturedAt: DateTime.now().toISO()
      });
      
      // Schedule lead follow-up in 24h
      const leadFollowUpTime = DateTime.now().plus({ hours: 24 }).toISO();
      db.tasks.push({
        type: 'lead-followup',
        target: customerPhone,
        time: leadFollowUpTime,
        message: "Hi! We noticed you were interested in service at Turbo Auto Repair. Any questions we can help with? Mention this message for 10% off your first diagnostic!"
      });
      saveDb(db);
    }
  }
  res.sendStatus(200);
});

// Simple Task Scheduler
setInterval(() => {
  const db = loadDb();
  const now = DateTime.now();
  const remainingTasks = [];

  db.tasks.forEach(task => {
    if (DateTime.fromISO(task.time) <= now) {
      sendSms(task.target, task.message);
    } else {
      remainingTasks.push(task);
    }
  });

  if (remainingTasks.length !== db.tasks.length) {
    db.tasks = remainingTasks;
    saveDb(db);
  }
}, 60000); // Check every minute

app.listen(PORT, () => {
  console.log(`Turbo Auto Repair Agent Server running on port ${PORT}`);
});
