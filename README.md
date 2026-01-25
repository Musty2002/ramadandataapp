# Ramadan Data App (RDA)

A mobile-first digital services platform for purchasing airtime, data bundles, electricity tokens, TV subscriptions, and exam pins in Nigeria.

## Features

- 💳 **Virtual Account** - Fund wallet via bank transfer
- 📱 **Airtime & Data** - Purchase for MTN, Airtel, Glo, 9Mobile
- ⚡ **Electricity** - Buy prepaid/postpaid tokens
- 📺 **TV Subscriptions** - DSTV, GOtv, Startimes
- 📝 **Exam Pins** - WAEC, NECO, NABTEB, JAMB
- 👥 **Referral System** - Earn bonuses for referrals
- 🔐 **Secure** - Transaction PIN & biometric authentication
- 📲 **Push Notifications** - Real-time transaction alerts

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend**: Supabase (Database, Auth, Edge Functions)
- **Mobile**: Capacitor (Android/iOS)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or bun

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd ramadan-data-app

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building for Android

```bash
# Build the web app
npm run build

# Sync with Capacitor
npx cap sync

# Open in Android Studio
npx cap open android
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Route pages
├── hooks/          # Custom React hooks
├── lib/            # Utility functions
├── integrations/   # External service integrations
└── assets/         # Images and static assets

supabase/
└── functions/      # Edge functions for API calls
```

## Environment Variables

The app requires the following environment variables:

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key

## Support

- 📧 Email: ramadandataapp@gmail.com
- 📞 Phone: 09068502050
- 💬 WhatsApp: +2347032168097

## License

This project is proprietary software. All rights reserved.
