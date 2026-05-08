# Turbo Auto Repair AI Agent

AI-powered voice and chat agent for Turbo Auto Repair in Baton Rouge, LA.

## Features
- **24/7 Booking**: Handles appointments for oil changes, brakes, tires, and more.
- **Business Hours Aware**: Correctly identifies when the shop is open/closed and suggests appropriate slots.
- **Automated Follow-ups**: 
  - SMS confirmation upon booking.
  - SMS reminder 24 hours before the appointment.
  - Review request 1 day after service.
  - Maintenance reminders every 3 months.
- **Lead Capture**: Automatically follows up with potential customers who didn't book.
- **Escalation**: Notifies the shop owner via SMS for urgent issues or complaints.

## Project Structure
- `server.js`: The main backend handling tool calls, webhooks, and the task scheduler.
- `assistant-config.json`: Vapi assistant configuration (System prompt, tools, voice).
- `chat.js`: Example implementation for a text-based chat agent.
- `db.json`: Local JSON file acting as a mock database for appointments and leads.

## Prerequisites
- **Vapi Account**: For the voice AI (vapi.ai).
- **OpenAI API Key**: Used by Vapi and the chat agent.
- **Twilio Account**: For SMS notifications (or any other SMS provider).
- **Google Calendar API**: For scheduling integration.

## Setup Instructions

### 1. Backend Server
Deploy `server.js` to a publicly accessible URL (e.g., Vercel, Railway, or a VPS).
```bash
npm install
node server.js
```

### 2. Vapi Configuration
1. Log in to your [Vapi Dashboard](https://dashboard.vapi.ai).
2. Create a new Assistant using the configuration in `assistant-config.json`.
3. Set the **Tool Server URL** in the assistant settings to `https://your-server.com/api/vapi/tools`.
4. Set the **Server URL** (webhook) for the assistant to `https://your-server.com/api/vapi/status`.

### 3. Google Calendar Integration
Configure the `gws` CLI or your own Google Calendar API credentials. Ensure the server has permission to write to the shop's calendar.

### 4. SMS Configuration
Update the `sendSms` function in `server.js` with your Twilio credentials or use an SMS skill.

### 5. Chat Integration
Integrate `chat.js` into your website's chat widget. It uses the same system prompt and tools as the voice assistant to ensure consistency.

## Business Details
- **Address**: 7640 Florida Blvd, Baton Rouge, LA 70806
- **Phone**: (225) 930-5472
- **Owner Notification Phone**: (225) 930-5472
- **Hours**: 
  - Mon-Fri: 8 AM - 6 PM
  - Sat: 8 AM - 1 PM
  - Sun: Closed
