# CBT Backend API

Deployment-ready backend for CBT Exam Simulator.

## Features

- Separate backend service for frontend integration.
- MongoDB for all persistent data.
- Cloudinary integration for question image uploads.
- Admin authentication (signup/login).
- Student authentication (signup/login).
- Section management (create, read, update, delete) by admin.
- MCQ-only question management (create, read, update, delete) by admin.
- Exam submission by students.
- Student scores and correct answers visible to admin only.
- Admin-wise student result access including student-wise answers.
- Cheating-aware submission metadata (termination remark, cheating attempts, option-change analytics).

## Tech Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- Cloudinary + Multer

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill values:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_strong_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
FRONTEND_ADMIN_URL=http://localhost:3000
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
ADMIN_ANALYTICS_RATE_WINDOW_MS=60000
ADMIN_ANALYTICS_RATE_MAX_REQUESTS=60
ADMIN_EXPORT_RATE_WINDOW_MS=600000
ADMIN_EXPORT_RATE_MAX_REQUESTS=10
KEEP_ALIVE_ENABLED=true
# Optional explicit ping URL (defaults to RENDER_EXTERNAL_URL + /api/health)
KEEP_ALIVE_URL=https://your-backend-domain.onrender.com/api/health
```

3. Run in development:

```bash
npm run dev
```

4. Run in production:

```bash
npm start
```

## API Base URL

- Local: `http://localhost:5000`

## Main Routes

### Auth

- `POST /api/auth/admin/signup`
- `POST /api/auth/admin/login`
- `POST /api/auth/student/signup`
- `POST /api/auth/student/login`

### Admin (Bearer token required, role: admin)

- `POST /api/admin/sections`
- `GET /api/admin/sections`
- `PUT /api/admin/sections/:sectionId`
- `DELETE /api/admin/sections/:sectionId`
- `POST /api/admin/questions` (multipart supported: `questionImage`)
- `GET /api/admin/questions/section/:sectionId`
- `PUT /api/admin/questions/:questionId`
- `DELETE /api/admin/questions/:questionId`
- `GET /api/admin/students`
- `GET /api/admin/students/:studentId/submissions`
- `DELETE /api/admin/students/:studentId`
- `GET /api/admin/analytics`
- `GET /api/admin/insights`
- `GET /api/admin/submissions/recent`
- `GET /api/admin/students/:studentId/submissions/export`

Analytics and export routes are protected with admin audit logging and rate-limits for production hardening.

### Student (Bearer token required, role: student)

- `GET /api/student/sections`
- `GET /api/student/questions/section/:sectionId`
- `POST /api/student/submit`

## Student Submission Request Format

`POST /api/student/submit`

```json
{
  "sectionId": "mongo_section_id",
  "sessionId": "mongo_session_id",
  "answers": [
    { "questionId": "mongo_question_id", "selectedOptionIndex": 1 },
    { "questionId": "mongo_question_id", "selectedOptionIndex": 3 }
  ],
  "remark": "Exam terminated due to cheating.",
  "examMeta": {
    "terminatedDueToCheating": false,
    "terminationRemark": "",
    "cheatingAttempts": 1,
    "totalOptionChanges": 4,
    "questionInteractions": [
      {
        "questionId": "mongo_question_id",
        "firstSelectedOptionIndex": 2,
        "finalSelectedOptionIndex": 1,
        "changeCount": 1,
        "selectionHistory": [2, 1]
      }
    ]
  }
}
```

Students do not receive score in API response. Score and correct answers are available to admin only.

Question order and options are shuffled per student via secure session mapping.

## Admin Pages

Admin UI is served by frontend React app:

- `${FRONTEND_ADMIN_URL}/admin/login`
- `${FRONTEND_ADMIN_URL}/admin/signup`
- `${FRONTEND_ADMIN_URL}/admin/dashboard`

Backend shortcut routes:

- `/admin/login`
- `/admin/signup`
- `/admin/dashboard`

## Deployment Notes

- Set all environment variables in your hosting platform.
- For production CORS, set `CLIENT_URL` as comma-separated frontend origins.
- Example: `CLIENT_URL=https://examindo.vercel.app,https://www.your-frontend.com`
- Optional for Vercel previews: include `https://*.vercel.app` in `CLIENT_URL`.
- Set `FRONTEND_ADMIN_URL` to your frontend base URL for admin redirects.
- Ensure MongoDB Atlas IP allow-list includes your deployment provider.
- Ensure Cloudinary credentials are valid if using question image upload.
- Keep-alive ping runs every 10 minutes in production by default.
- If needed, set `KEEP_ALIVE_ENABLED=false` to disable.
- If `KEEP_ALIVE_URL` is not set, backend will use `RENDER_EXTERNAL_URL + /api/health`.

### Prevent Render Sleep (External Wake Every 10 Minutes)

To reliably wake a sleeping Render service, use the included GitHub Actions workflow:

- File: `.github/workflows/render-keepalive.yml`
- Schedule: every 10 minutes
- Endpoint pinged: `/api/health`

Set this repository secret in GitHub:

- `RENDER_BACKEND_URL=https://your-service-name.onrender.com`

This external ping can wake the service even after Render idles it.
