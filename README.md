# Real-Estate-voice-agent-lead-management🏡

An AI-powered **Real Estate Voice Agent** that automates customer calls using **Voice agent** **Node.js**, **Express.js**, **PostgreSQL**, **Power BI**, and **ngrok**.

The system answers customer calls, conducts natural conversations, captures customer requirements, stores call information in PostgreSQL, and visualizes insights through Power BI dashboards.

---

# 📌 Features

- 📞 AI-powered real estate voice conversations
- 🤖 Human-like call experience using Retell AI
- 📝 Automatic call transcription
- 🎙️ Call recording generation
- 📊 AI-generated call summaries
- 🏠 Lead qualification
- 💾 PostgreSQL database integration
- 🔗 Webhook support
- 📈 Power BI dashboard for analytics
- 🌐 Public webhook support using ngrok

---

# 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| Retell AI | AI Voice Conversations |
| Node.js | Backend Runtime |
| Express.js | REST APIs & Webhooks |
| PostgreSQL | Database |
| Power BI | Analytics Dashboard |
| ngrok | Public URL for Webhooks |

---

# 📁 Project Structure

```
Voice-Agent/
│
├── src/
│   ├── server.js
│   ├── routes/
│   ├── controllers/
│   ├── database/
│   └── webhook/
│
├── .env
├── package.json
└── README.md
```

---

#DEMO VEDIO

https://github.com/user-attachments/assets/18955060-81b9-4246-8431-e8280ab1c902

<img width="842" height="520" alt="WhatsApp Image 2026-07-07 at 11 57 18 PM" src="https://github.com/user-attachments/assets/cbdee0f2-8e33-4ad9-8c84-5714cd47be04" />

<img width="1440" height="547" alt="Screenshot 2026-06-01 at 2 24 46 AM" src="https://github.com/user-attachments/assets/824b4050-fc9a-4767-98b6-4e12d77ddb24" />
<img width="2816" height="1536" alt="Gemini_Generated_Image_at64ztat64ztat64" src="https://github.com/user-attachments/assets/4601d39a-a2db-4559-ac7a-00c8d1818c26" />
<img width="1439" height="807" alt="Screenshot 2026-07-13 at 2 32 16 AM" src="https://github.com/user-attachments/assets/d3b44a08-96d1-47dc-93b6-51f1df608af7" />

<img width="990" height="714" alt="Screenshot 2026-07-13 at 2 31 48 AM" src="https://github.com/user-attachments/assets/bc5483e3-b8fe-42ab-bb96-d1c95bbe12e2" />

<img width="1206" height="779" alt="Screenshot 2026-07-13 at 2 31 29 AM" src="https://github.com/user-attachments/assets/3e939b3a-8390-4c5a-a5ea-bde42d2f157f" />





# ⚙️ Installation

## 1. Clone the Repository

```bash
git clone <repository-url>

cd Voice-Agent
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Environment Variables

Create a `.env` file.

---

# 🚀 Running the Project

Start the backend server:

```bash
npm start
```

or

```bash
npm run dev
```

---

# 🌐 ngrok Setup

Since Retell AI needs access to your local webhook, expose your local server using **ngrok**.

## Step 1

Authenticate ngrok

```bash
ngrok config add-authtoken YOUR_NGROK_AUTH_TOKEN
```

You only need to do this once.

---

## Step 2

Expose your local server

```bash
ngrok http 3000
```

Example output:

```
Forwarding

https://abc123.ngrok-free.app
```

Copy the HTTPS URL.

---

## Step 3

Update your `.env`

```env
PUBLIC_BASE_URL=https://abc123.ngrok-free.app
```

Restart the server after updating the URL.

---

# 📞 How It Works

1. Customer calls the business number.
2. Retell AI answers the call.
3. AI conducts a natural conversation.
4. Customer shares property requirements.
5. Retell AI generates:
   - Transcript
   - Recording
   - AI Summary
   - Call Insights
6. Retell AI sends data to the backend through webhooks.
7. Express.js processes the webhook.
8. Call data is stored in PostgreSQL.
9. Power BI reads the stored data and displays interactive dashboards.

---

# ❗ Problem Statement

In the real estate industry, customers often call to inquire about properties, pricing, site visits, or other details. However, many businesses face challenges such as:

- Calls being missed when agents are busy or unavailable.
- Long waiting times for customers.
- Manual note-taking during conversations.
- Important customer information getting lost.
- Difficulty in reviewing past conversations and identifying customer requirements.

These issues reduce customer satisfaction and make lead management inefficient.

---

# 💡 Our Solution

To solve this problem, we developed an **AI-powered Voice Agent** that answers incoming customer calls automatically.

Instead of waiting for a human agent, customers interact directly with the AI assistant. The AI understands customer requirements, asks follow-up questions, provides relevant responses, and automatically records every interaction.

---

# 🔄 Workflow

1. Customer calls the real estate business.
2. Retell AI answers the call.
3. AI asks questions such as:
   - What type of property are you looking for?
   - Which location are you interested in?
   - What is your budget?
   - Are you buying or renting?
4. The conversation continues naturally.
5. After the call ends, Retell AI generates:
   - Call transcript
   - Call recording
   - AI-generated summary
   - Key insights
6. Webhooks send this data to the backend.
7. Express.js stores it in PostgreSQL.
8. Power BI visualizes the data through dashboards.

---

# 📊 Insights Generated

The system automatically extracts valuable information including:

- Customer Name
- Phone Number
- Property Preference
- Preferred Location
- Budget
- Buying or Renting Intent
- Level of Interest
- Questions Asked
- Conversation Summary
- Call Duration
- Recording URL
- Transcript
- Call Outcome

---

# 📈 Power BI Dashboard

Power BI provides interactive dashboards to visualize:

- Total Calls
- Qualified Leads
- Buying vs Renting Ratio
- Customer Budget Distribution
- Popular Property Locations
- Average Call Duration
- Call Volume Trends
- Lead Conversion Metrics

---

# 🚀 Technologies Used

- Retell AI
- Node.js
- Express.js
- PostgreSQL
- REST APIs
- Webhooks
- Power BI
- ngrok

---

# ✅ Benefits

- 24×7 AI Call Handling
- No Missed Customer Calls
- Human-like Conversations
- Automatic Transcripts
- Automatic Call Recordings
- AI-generated Insights
- Faster Lead Qualification
- Better Customer Relationship Management
- Reduced Manual Work
- Data-driven Decision Making with Power BI

---

# 📌 Future Enhancements

- SMS & Email Notifications
- CRM Integration
- Multi-language Support
- Appointment Scheduling
- WhatsApp Integration
- Live Agent Handoff
- Sentiment Analysis
- Advanced Analytics Dashboard

---

# 👨‍💻 Author

**Kanika Gupta**

---

# 📄 License

This project is intended for educational and demonstration purposes.

---

## Thank You ❤️

This AI Voice Agent acts as a virtual real estate assistant that answers customer calls, understands customer requirements, stores conversations securely, and provides actionable insights through Power BI dashboards. It helps real estate businesses improve customer service, streamline lead management, and make data-driven decisions.
