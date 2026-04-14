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

The application relies on four primary tables:

### parks
- id (Primary Key)
- name
- nearest_city
- county
- description
- (Planned) state for multi-state expansion

### visits
- id (Primary Key)
- user_id (UUID stored in localStorage)
- park_id (Foreign Key to parks)
- visit_date
- notes (Optional)

### achievements
- id (Primary Key)
- name
- description
- threshold (Number of parks required)

### user_achievements
- id (Primary Key)
- user_id
- achievement_id (Foreign Key)
- unlocked_at

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
