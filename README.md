# 📘 Project Overview

State Parks Passport is a mobile-first web application that allows users to track visits to state parks, celebrate milestones through achievements, and build a personal record of their outdoor adventures. The platform is designed to be simple, privacy-conscious, and scalable, beginning with the Wisconsin State Parks system as its first edition, with the long-term vision of expanding to include parks across the United States.

The application functions as a digital “passport,” enabling users to mark parks as visited, record visit dates and optional notes, and visualize their progress through intuitive dashboards and achievement milestones. By eliminating the need for traditional user accounts and instead utilizing an anonymous UUID stored in the browser’s local storage, the app offers a frictionless onboarding experience while maintaining user privacy.

## 🌲 Key Objectives

- Encourage Outdoor Exploration: Motivate users to visit and experience state parks.
- Provide a Digital Keepsake: Allow users to document their visits and memories.
- Celebrate Milestones: Reward engagement through an achievements system.
- Maintain Privacy: Enable personalized tracking without requiring personal information.
- Support Scalability: Establish a flexible architecture for expansion to additional states.
- Enable Future Monetization: Lay the groundwork for premium features, partnerships, and merchandise.

## 🧭 Core Features

### 1. Park Discovery
- Browse a comprehensive list of state parks.
- View detailed information for each park, including:
  - Park name
  - Nearest city
  - County
  - Enhanced descriptive content

### 2. Visit Tracking
- Mark parks as **visited** with a simple toggle.
- Automatically record the **visit date**, with the option to customize it.
- Add **optional notes** to capture memories or observations.
- Remove a visit if needed, ensuring flexibility and accuracy.

### 3. Anonymous User Identification
- Each user is assigned a **UUID** stored in `localStorage` as `USER_ID`.
- No sign-up or login is required.
- Ensures privacy while allowing persistent progress tracking across sessions.

### 4. Achievements System
- Users unlock achievements based on the number of unique parks visited.
- Achievements are defined in the `achievements` table with configurable thresholds.
- Progress toward the next achievement is visually displayed.
- Newly unlocked achievements are highlighted with subtle animations.

### 5. Progress Visualization
- Achievement Progress Bar: Displays progress toward the next milestone.
- Total Parks Progress Bar: Shows the number of unique parks visited relative to the total available.

### 6. Responsive, Mobile-First Design
- Optimized for smartphones while remaining fully functional on tablets and desktops.
- Clean and intuitive interface with accessible navigation.

### 7. Privacy and Transparency
- Minimal data collection limited to anonymous identifiers and visit information.
- Dedicated Privacy Policy and Terms of Use pages.
- Optional privacy-friendly analytics via Vercel Insights.

## 🛠️ Technical Architecture

### Frontend
- Technologies: HTML, CSS, and vanilla JavaScript.
- Design Approach: Mobile-first responsive layout.
- State Management: Centralized `state` object within a single `app.js` file.
- Environment Configuration: Supabase credentials stored in `env.js` and accessed via `window.ENV`.

### Backend
- Platform: Supabase REST API.
- Database: PostgreSQL managed by Supabase.
- Authentication: None required; users are identified via a locally stored UUID.

### Deployment
- Hosting: Vercel.
- Version Control: GitHub with automatic deployments.
- Analytics: Optional integration with Vercel Web Analytics.

## 🗄️ Database Schema

The application uses Supabase (PostgreSQL) to manage data. The schema is designed for simplicity while supporting future scalability to additional states.

### 1. `parks`
Stores information about each state park.

| Column | Type | Description |
|-------|------|-------------|
| `id` | integer (Primary Key) | Unique identifier for each park |
| `name` | text | Name of the park |
| `nearest_city` | text | Closest city to the park |
| `county` | text | County where the park is located |
| `description` | text | Detailed description of the park |
| `state` | text (optional) | State abbreviation for multi-state expansion |

### 2. `visits`
Tracks parks visited by each user.

| Column | Type | Description |
|-------|------|-------------|
| `id` | integer (Primary Key) | Unique identifier for each visit |
| `user_id` | text | Anonymous UUID stored in the user's browser |
| `park_id` | integer (Foreign Key) | References `parks.id` |
| `visit_date` | date | Date the park was visited |
| `notes` | text | Optional user notes |

### 3. `achievements`
Defines milestone achievements.

| Column | Type | Description |
|-------|------|-------------|
| `id` | integer (Primary Key) | Unique identifier for each achievement |
| `name` | text | Achievement title |
| `description` | text | Description of the achievement |
| `threshold` | integer | Number of parks required to unlock |

### 4. `user_achievements`
Tracks which achievements have been unlocked by each user.

| Column | Type | Description |
|-------|------|-------------|
| `id` | integer (Primary Key) | Unique identifier |
| `user_id` | text | Anonymous UUID |
| `achievement_id` | integer (Foreign Key) | References `achievements.id` |
| `unlocked_at` | timestamp | Date and time the achievement was unlocked |

### Relationships
- `visits.park_id` → `parks.id`
- `user_achievements.achievement_id` → `achievements.id`
- `user_id` links user-specific data across tables.

### Future Enhancements
- A `states` table to support multi-state expansion.
- Additional fields for geolocation (latitude and longitude).
- Supabase Storage integration for photo uploads.

## 🚀 Deployment Instructions

The State Parks Passport application is deployed using **Vercel**, with source code managed in **GitHub**. The deployment process is fully automated through GitHub integration.

### 1. Push Code to GitHub
Ensure your project is committed and pushed to your GitHub repository:

git add .
git commit -m "Prepare project for deployment"
git push origin main

## 🚀 Deployment Instructions

### 2. Import the Repository into Vercel

1. Log in to **https://vercel.com**.
2. Click **Add New Project**.
3. Select your GitHub repository.
4. Accept the default build settings (no build command is required for static sites).
5. Click **Deploy**.

### 3. Configure Environment Variables

The project uses an `env.js` file to store Supabase credentials. However, you may optionally configure these values within Vercel for additional flexibility and security.

If you choose to use Vercel environment variables:

1. Navigate to your project dashboard in Vercel.
2. Go to **Settings → Environment Variables**.
3. Add the following variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Update your `env.js` file to reference these variables if needed.

> **Note:** Ensure that `env.js` is included in your `.gitignore` file to prevent sensitive information from being committed to the repository.

### 4. Automatic Deployments

- Every push to the **`main`** branch triggers a new **production deployment**.
- **Preview deployments** are automatically generated for pull requests (if pull requests are used), allowing you to test changes before merging.

### 5. Custom Domain

To connect a custom domain:

1. Navigate to your project in Vercel.
2. Go to **Settings → Domains**.
3. Add your custom domain (e.g., `stateparkspassport.com`).
4. Update your DNS records as instructed by Vercel.
5. Once DNS propagation is complete, your application will be accessible via the custom domain.

### 6. Enable Vercel Analytics

To enable privacy-friendly analytics, add the following script to each HTML page just before the closing `</body>` tag:

```html
<script defer src="/_vercel/insights/script.js"></script>

## 🔐 Privacy-First Design

The application is intentionally designed to minimize data collection:

- No personal information (e.g., name or email) is required.
- Users are identified only by an anonymous UUID.
- Data is stored securely using Supabase.
- Users can reset their data by clearing browser storage.

## 🌎 Vision for Expansion

While the initial release focuses on Wisconsin, the platform is architected for national scalability. Future enhancements include:

- Support for multiple states via a `state` field or dedicated `states` table.
- State-specific achievements and branding.
- Interactive maps for park exploration.
- Optional photo uploads for visit memories.
- Social sharing and community features.
- Premium features and partnerships with park organizations.

## 💡 Potential Monetization Opportunities

- Premium Features: Enhanced statistics, photo storage, or advanced achievements.
- Merchandise: Branded apparel, stickers, or physical passport books.
- Partnerships: Collaborations with state park systems or tourism boards.
- Donations: Voluntary contributions to support ongoing development.
- Affiliate Programs: Integration with outdoor gear or travel services.

## 🛠️ Tech Stack

The State Parks Passport application is built with a focus on simplicity, scalability, and maintainability. The technology choices prioritize a lightweight architecture while enabling future expansion to additional states and features.

### Frontend
- **HTML5** – Provides the structural foundation for the application.
- **CSS3** – Handles responsive, mobile-first styling and layout.
- **Vanilla JavaScript (ES6+)** – Manages all application logic, state management, and user interactions within a single `app.js` file.
- **LocalStorage** – Stores an anonymous UUID (`USER_ID`) to uniquely identify users without requiring authentication.

### Backend
- **Supabase (PostgreSQL)** – Serves as the backend database and provides a RESTful API for data access.
- **Supabase REST API** – Enables CRUD operations on database tables without the need for a custom server.

### Deployment & Hosting
- **Vercel** – Hosts the static frontend and provides automatic deployments through GitHub integration.
- **GitHub** – Version control and collaboration platform.

### Analytics
- **Vercel Web Analytics** – Privacy-friendly analytics implemented via a lightweight script.

### Development Principles
- **Mobile-First Design** – Ensures optimal usability on smartphones and tablets.
- **Privacy-First Approach** – No personal user data is collected; users are identified only by an anonymous UUID.
- **Simplicity & Maintainability** – Avoids frameworks and overengineering to keep the codebase approachable and easy to extend.

## ✅ Key Functions

```markdown
## 🔑 Key Functions

The application logic is centralized within a single `app.js` file. The following functions play a critical role in managing data and user interactions.

### `safeFetch(endpoint, options, returnType)`
A reusable helper function that standardizes API communication and error handling.

- Handles HTTP errors consistently.
- Supports JSON and non-JSON responses.
- Provides user-friendly error alerts.
- Simplifies all Supabase API interactions.

### `getHeaders()`
Returns the required headers for authenticating requests to the Supabase REST API.

- Includes the `apikey` and `Authorization` bearer token.
- Ensures consistent request configuration across the application.

### `fetchVisits()`
Retrieves all visit records associated with the current user.

- Filters results using the anonymous `USER_ID`.
- Updates the application state with the user's visit history.

### `saveVisit(parkId, visitDate, notes)`
Creates a new visit record in the `visits` table.

- Accepts a park ID, visit date, and optional notes.
- Returns the created record for immediate UI updates.

### `deleteVisit(parkId)`
Removes a visit record for the specified park.

- Ensures only the current user's visit is deleted.
- Used by the visit toggle functionality.

### `handleVisitClick()`
Manages the logic for toggling a park’s visited status.

- Determines whether to create or delete a visit.
- Refreshes the application state.
- Triggers achievement checks and UI updates.

### `checkAchievements()`
Evaluates whether the user has reached new achievement thresholds.

- Compares the number of unique parks visited against defined milestones.
- Inserts new records into `user_achievements` when thresholds are met.

### `renderApp()`
Controls the rendering of the user interface based on the current application state.

- Updates views such as the dashboard, park list, and detail view.
- Ensures a consistent and responsive user experience.

### `updateTotalProgress()`
Calculates and updates the total parks visited progress bar.

- Provides users with visual feedback on their overall progress.

## 📄 License

This project is licensed under the **MIT License**, which permits reuse, modification, and distribution with minimal restrictions.

### MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
