<img width="1440" height="547" alt="Screenshot 2026-06-01 at 2 24 46 AM" src="https://github.com/user-attachments/assets/824b4050-fc9a-4767-98b6-4e12d77ddb24" />

<img width="1600" height="956" alt="WhatsApp Image 2026-06-01 at 02 02 46" src="https://github.com/user-attachments/assets/5418118b-2b70-4c97-9a67-72e19ddd6fdc" />
<img width="1224" height="675" alt="Screenshot 2026-06-01 at 2 09 18 AM" src="https://github.com/user-attachments/assets/79784b69-38f5-4681-8e87-9ac4a188fb2f" />

Retell + Twilio Trial Caller

Small trial app for outbound real estate lead qualification calls.


The browser triggers a call, the server calls Retell's Create Phone Call API, Retell uses your imported/bound Twilio number, and Retell webhooks/tool calls update the dashboard with transcript, analysis, and property estimate data.

Demo 


https://github.com/user-attachments/assets/180c8fd6-ae8a-45a5-8962-de207b4f6217



## What is included

- Frontend dashboard to trigger calls and view call history.
- Backend endpoint to create outbound Retell phone calls.
- Retell webhook endpoint with HMAC signature verification.
- Retell custom function endpoint: `get_property_estimate`.
- PostgreSQL storage in the existing `call_logs` table for live dashboard/reporting use.
- Human-style real estate agent prompt you can paste into Retell.

## Requirements

- Node.js 18+
- Retell API key
- Twilio trial number imported/bound in Retell
- Verified destination number in Twilio if you are on a Twilio free trial
- PostgreSQL database with the existing `call_logs` table from `retell database.sql`
- `ngrok` or another public tunnel for Retell webhooks while running locally

## Run locally

```bash
cp .env.example .env
npm install
npm run migrate
npm start
```

Open:

```text
http://localhost:3000
```

## Environment

Edit `.env`:

```bash
RETELL_API_KEY=key_xxx
TWILIO_FROM_NUMBER=+14155550100
RETELL_AGENT_ID=agent_xxx
RETELL_AGENT_VERSION=
PUBLIC_BASE_URL=https://your-ngrok-url.ngrok-free.app
PORT=3000
VERIFY_RETELL_SIGNATURE=true
DATABASE_URL=postgres://postgres:password@localhost:5432/real_estate_voice_agent
```

`TWILIO_FROM_NUMBER` must be the Twilio number after it is imported or configured in Retell. The app does not call Twilio directly because the voice agent runs inside Retell; Retell places the outbound call using the configured telephony number.

For PostgreSQL, use either `DATABASE_URL` or individual connection variables:

```bash
PGHOST=localhost
PGPORT=5432
PGDATABASE=real_estate_voice_agent
PGUSER=postgres
PGPASSWORD=password
PGSSL=false
```

The application does not create a new database. Run `npm run migrate` once to create/update the `call_logs` table. New calls, Retell webhook updates, property estimate tool calls, manual API updates, and deletes are persisted in PostgreSQL, so Power BI will see the latest rows after report refresh.

Power BI can connect directly to `call_logs`. Useful reporting columns now include `transcript`, `transcript_key_points`, `qualified`, `sell_timeline`, `motivation`, `objections`, `follow_up_required`, `sentiment`, `property_estimate`, `summary`, `analysis`, and `tool_calls`.

## Retell setup

1. Create a Retell voice agent.
2. Bind your Twilio/imported phone number as the outbound number for that agent.
3. Add these dynamic variables in the prompt:

```text
{{owner_name}}
{{property_address}}
{{lead_source}}
{{agent_name}}
```

4. Set webhook URL:

```text
{PUBLIC_BASE_URL}/api/webhooks/retell
```

5. Subscribe to these events:

```text
call_started
transcript_updated
call_ended
call_analyzed
```

6. Add a custom function:

```text
Name: get_property_estimate
Method: POST
URL: {PUBLIC_BASE_URL}/api/tools/property-estimate
```

Schema:

```json
{
  "type": "object",
  "required": ["property_address"],
  "properties": {
    "property_address": {
      "type": "string",
      "description": "The homeowner property address being discussed."
    },
    "call_id": {
      "type": "string",
      "description": "The Retell call id if available."
    }
  }
}
```

7. Add post-call analysis fields in Retell:

```text
qualified: enum yes, no, maybe
sell_timeline: enum asap, 3_to_6_months, 6_to_12_months, just_exploring
motivation: string
objections: string
follow_up_required: boolean
call_sentiment: enum positive, neutral, negative
key_points: string or list of strings
```

## Agent prompt

Paste this into the Retell agent prompt and tune voice settings for your preferred voice:

```text
You are {{agent_name}}, a warm real estate assistant calling homeowners for a short, natural lead qualification conversation.

You are calling {{owner_name}} about {{property_address}}. The lead came from {{lead_source}}.

Your job is to understand whether the homeowner is considering selling and whether a human real estate agent should follow up. Do not sound like you are reading a script. Keep turns short, use natural pauses, and acknowledge interruptions gracefully.

Opening:
Start with: "Hi {{owner_name}}, this is {{agent_name}}. I know this is out of the blue, but I’m reaching out about {{property_address}}. Did I catch you at an okay time?"

Conversation style:
- Be friendly, calm, and concise.
- Use light filler naturally: "yeah", "got it", "that makes sense", "let me think for a second".
- Ask one question at a time.
- If the homeowner interrupts, stop and respond to what they said.
- If they are busy, offer a quick callback.
- If they are not interested, politely thank them and end the call.
- Never pressure them.

Qualify naturally:
- Are they considering selling?
- What timeline are they thinking: ASAP, 3 to 6 months, 6 to 12 months, or just exploring?
- Why might they sell?
- What is the property condition?
- Do they have a mortgage or any payoff concerns?
- Have they spoken with other agents?

Property estimate tool:
Once the homeowner confirms the property or asks about value, call get_property_estimate with property_address. Use the result conversationally, for example: "Based on recent comparable sales nearby, homes like yours are landing around..."

Close:
If qualified or maybe qualified, ask permission to schedule a callback with a human local agent. Confirm the best time. If not qualified, end warmly.
```

## API routes

- `POST /api/calls` creates an outbound Retell call.
- `GET /api/calls` lists stored calls.
- `GET /api/calls/:id` returns one call.
- `PATCH /api/calls/:id` updates editable call fields in PostgreSQL.
- `PUT /api/calls/:id` updates editable call fields in PostgreSQL.
- `DELETE /api/calls/:id` deletes one call from PostgreSQL.
- `POST /api/webhooks/retell` receives Retell webhook events.
- `POST /api/tools/property-estimate` returns mock property estimate data.

## Notes for trial

- Twilio free trial accounts can call only verified destination numbers.
- Retell requires a public HTTPS URL for webhooks and custom tools; use `ngrok http 3000`.
- For quick local endpoint testing before Retell is connected, set `VERIFY_RETELL_SIGNATURE=false`. Turn it back on for real Retell traffic.

## References

- Retell Create Phone Call API: https://docs.retellai.com/api-references/create-phone-call
- Retell outbound calls: https://docs.retellai.com/deploy/outbound-call
- Retell dynamic variables: https://docs.retellai.com/build/dynamic-variables
- Retell webhooks and signature verification: https://docs.retellai.com/features/webhook-overview
- Retell custom functions: https://docs.retellai.com/build/conversation-flow/custom-function
