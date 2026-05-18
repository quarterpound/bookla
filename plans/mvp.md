# Bookla

## What This Is

Bookla is a reservation platform for barbers, salons, and spas in Azerbaijan. It lets beauty professionals accept online bookings through a shareable link, manage their schedule, and track clients. The platform has two plans:

- **Personal (Free Forever):** For solo professionals. One calendar, one booking link, basic features.
- **Business (15 AZN/seat/month):** For multi-staff shops. Multiple staff calendars, team management, business dashboard.

"Per seat" means per active staff member who accepts bookings. A salon with 4 barbers = 4 seats = 60 AZN/month.

The target user is a barber in Baku who wants to share a booking link on Instagram and wake up with confirmed appointments. Everything must be mobile-first — both the client booking flow and the professional's dashboard.

---

## Tech Stack

- **Frontend:** Next.js 14+ (App Router) with TypeScript and Tailwind CSS
- **Backend:** Next.js API routes (or separate Node/Express server if you prefer clear separation)
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** NextAuth.js with phone number + OTP login (professionals only — clients never need accounts)
- **SMS:** Integrate with a placeholder SMS service (create an abstraction layer so the actual provider can be swapped later)
- **Payments:** Stub only for MVP — no real payment processing, just track plan/seat info in the database
- **Deployment:** Docker-ready with docker-compose for local dev (PostgreSQL + app)

---

## Database Schema

Design these models in Prisma. All timestamps in UTC. Use UUIDs for all primary keys.

### User (the professional)

This is the person who logs into the dashboard. Could be a solo barber or a salon owner.

```
User
  id          UUID (primary key)
  phone       String (unique, E.164 format like +994XXXXXXXXX)
  name        String
  avatarUrl   String? (optional)
  createdAt   DateTime
  updatedAt   DateTime
```

### Business

Every user belongs to exactly one business. A solo barber's business has one staff member (themselves). A salon owner's business has multiple.

```
Business
  id              UUID (primary key)
  ownerId         UUID (foreign key -> User.id)
  name            String (e.g. "Tural's Barbershop")
  slug            String (unique, URL-safe, used for booking page: bookla.az/b/{slug})
  description     String? (short bio shown on booking page)
  address         String?
  phone           String? (public contact number, can differ from owner's login phone)
  avatarUrl       String? (logo or photo)
  plan            Enum: PERSONAL | BUSINESS (default PERSONAL)
  timezone        String (default "Asia/Baku")
  createdAt       DateTime
  updatedAt       DateTime
```

### Staff

Each bookable person in a business. For Personal plan, there's exactly one staff record (the owner). For Business plan, the owner adds staff members.

```
Staff
  id              UUID (primary key)
  businessId      UUID (foreign key -> Business.id)
  userId          UUID? (foreign key -> User.id, nullable — staff may not have a login)
  name            String
  phone           String?
  avatarUrl       String?
  isActive        Boolean (default true, inactive staff don't show on booking page)
  sortOrder       Int (display order on booking page)
  createdAt       DateTime
  updatedAt       DateTime
```

### Service

The services a business offers. Each service has a name, duration, and price. Duration drives the time slot calculation engine.

```
Service
  id              UUID (primary key)
  businessId      UUID (foreign key -> Business.id)
  name            String (e.g. "Haircut", "Beard Trim", "Full Package")
  durationMinutes Int (e.g. 30, 15, 60 — this is critical for slot availability)
  priceAmount     Int (stored in qəpik, so 1500 = 15.00 AZN)
  currency        String (default "AZN")
  isActive        Boolean (default true)
  sortOrder       Int
  createdAt       DateTime
  updatedAt       DateTime
```

### WorkingHours

Defines when each staff member is available. One record per day-of-week per staff member. If no record exists for a day, that day is off.

```
WorkingHours
  id              UUID (primary key)
  staffId         UUID (foreign key -> Staff.id)
  dayOfWeek       Int (0=Monday, 1=Tuesday, ..., 6=Sunday)
  startTime       String (HH:MM format, e.g. "09:00")
  endTime         String (HH:MM format, e.g. "18:00")
  breakStartTime  String? (e.g. "13:00")
  breakEndTime    String? (e.g. "14:00")
```

Unique constraint on (staffId, dayOfWeek) — one schedule entry per staff per day.

### DayOff

Specific dates when a staff member is unavailable (vacation, sick day, holiday). Overrides WorkingHours for that date.

```
DayOff
  id              UUID (primary key)
  staffId         UUID (foreign key -> Staff.id)
  date            Date
  reason          String? (optional, private to the business)
```

Unique constraint on (staffId, date).

### Booking

The central entity. Created when a client books through the public page OR when the professional adds a manual booking.

```
Booking
  id              UUID (primary key)
  businessId      UUID (foreign key -> Business.id)
  staffId         UUID (foreign key -> Staff.id)
  serviceId       UUID (foreign key -> Service.id)
  clientId        UUID (foreign key -> Client.id)
  date            Date
  startTime       String (HH:MM format, e.g. "14:30")
  endTime         String (HH:MM format, calculated from startTime + service.durationMinutes)
  status          Enum: CONFIRMED | CANCELLED | COMPLETED | NO_SHOW (default CONFIRMED)
  notes           String? (optional note from client or professional)
  source          Enum: ONLINE | MANUAL (how the booking was created)
  createdAt       DateTime
  updatedAt       DateTime
```

CRITICAL CONSTRAINT: Before creating any booking, the system MUST check that the time slot doesn't overlap with any existing CONFIRMED booking for the same staff member on the same date. This is the single most important data integrity rule in the entire application.

### Client

Auto-created from booking data. The professional never manually creates clients — they accumulate naturally.

```
Client
  id              UUID (primary key)
  businessId      UUID (foreign key -> Business.id)
  name            String
  phone           String
  notes           String? (private notes the professional can add)
  createdAt       DateTime
  updatedAt       DateTime
```

Unique constraint on (businessId, phone) — same phone = same client within a business.

### Notification

Log of all SMS notifications sent. Used for debugging and to avoid duplicate sends.

```
Notification
  id              UUID (primary key)
  bookingId       UUID (foreign key -> Booking.id)
  type            Enum: CONFIRMATION | REMINDER_24H | REMINDER_1H | CANCELLATION
  channel         Enum: SMS (only SMS for MVP)
  recipient       String (phone number)
  status          Enum: PENDING | SENT | FAILED
  sentAt          DateTime?
  createdAt       DateTime
```

---

## Core Features to Build

### 1. Public Booking Page

**Route:** `/b/{business.slug}`

This is the client-facing page. It must be fast, beautiful, and work flawlessly on mobile. No login required — clients never create accounts.

**Flow:**

1. Client opens the link (shared via Instagram, WhatsApp, etc.)
2. Page shows: business name, photo/logo, address, and list of services with prices and durations
3. Client taps a service
4. If Business plan with multiple staff: client picks a staff member (show names and photos). If Personal plan or single staff: skip this step automatically
5. Client sees a date picker (default today, can go forward up to 30 days, cannot book in the past)
6. For the selected date, show available time slots as tappable buttons (e.g. "09:00", "09:30", "10:00"...)
7. Client picks a slot
8. Client enters: name (required), phone number (required), optional note
9. Client taps "Confirm Booking"
10. Show confirmation screen with all details and a "Add to Calendar" option

**Time Slot Calculation Logic (this is the brain of the app):**

```
function getAvailableSlots(staffId, date, serviceDurationMinutes):
  1. Get WorkingHours for this staff member on this day-of-week
     - If no WorkingHours record exists for this day → return empty (day off)
  2. Check DayOff table for this staff + date
     - If a DayOff record exists → return empty
  3. Generate all possible slot start times between startTime and endTime
     - Slot interval: 15 minutes (so for 09:00-18:00, generate 09:00, 09:15, 09:30, ...)
     - A slot is valid only if startTime + serviceDurationMinutes <= endTime
     - Exclude slots that overlap with break time (breakStartTime to breakEndTime)
  4. Get all existing CONFIRMED bookings for this staff on this date
  5. Remove any generated slot that would overlap with an existing booking
     - A slot overlaps if: slotStart < existingBooking.endTime AND slotEnd > existingBooking.startTime
  6. If the date is today, remove all slots where startTime has already passed (use business timezone)
  7. Return remaining slots
```

The slot interval of 15 minutes is a constant — define it once, don't hardcode it everywhere.

**Design direction:** Clean, warm, premium feel. Think cream/gold palette. The booking page IS your marketing — every client who books through it sees your brand.

### 2. Authentication

Professionals log in with their phone number. No passwords — OTP only.

**Flow:**

1. Professional goes to `/login`
2. Enters phone number (+994 prefix auto-filled for Azerbaijan)
3. System sends a 6-digit OTP via SMS (for development, log OTP to console and also accept "000000" as a bypass code)
4. Professional enters OTP
5. If valid, create a session (use NextAuth.js with a custom credentials provider + JWT strategy)
6. If this is a first-time login, redirect to `/onboarding` to create their business profile
7. If returning user, redirect to `/dashboard`

**Onboarding flow (first-time only):**

1. Enter business name
2. Auto-generate a slug from the name (editable, must be unique, URL-safe)
3. Add at least one service (name, duration, price)
4. Set working hours (show a weekly grid, default Mon-Sat 09:00-18:00 with 13:00-14:00 break)
5. Done → redirect to dashboard with a prompt to share their booking link

### 3. Professional Dashboard

**Route:** `/dashboard`

This is where the professional manages their business. Must work well on mobile since many barbers will check it on their phone between clients.

#### 3a. Calendar View (the main screen)

This is the default view when they open the dashboard.

- **Day view (default):** Shows today's schedule as a vertical timeline. Each booking appears as a colored block showing the time, client name, and service. Empty slots are visible gaps. Tapping a booking opens its details.
- **Week view:** 7 columns (or fewer on mobile — swipeable), each showing that day's bookings as compressed blocks. Tapping a day switches to day view for that date.
- **Navigation:** Previous/next day buttons, a "Today" button to jump back, and a date picker to jump to any date.
- **For Business plan:** Toggle between individual staff calendars or an "all staff" view with side-by-side columns.

#### 3b. Manual Booking

A button on the calendar to add a booking manually (for walk-ins and phone calls).

**Flow:**

1. Tap "Add Booking"
2. Select a service
3. If Business plan: select a staff member (default to the current staff view)
4. Pick a date and time (show only available slots using the same calculation engine as the public page)
5. Enter client name and phone (auto-suggest from existing clients as they type the phone number)
6. Save → booking appears on calendar, client record auto-created if new

#### 3c. Services Management

**Route:** `/dashboard/services`

- List all services with name, duration, price, and active/inactive toggle
- Add new service: name (required), duration in minutes (required, dropdown: 15, 30, 45, 60, 90, 120), price in AZN (required)
- Edit existing service (tap to open edit form)
- Deactivate a service (soft delete — don't actually delete because existing bookings reference it)
- Drag to reorder (this controls the display order on the booking page)

#### 3d. Client List

**Route:** `/dashboard/clients`

- List all clients sorted by most recent visit
- Search by name or phone number
- Tap a client to see: all their past and upcoming bookings (newest first), total visit count, total amount spent, and a private notes field the professional can edit
- No manual client creation — clients are only created through bookings

#### 3e. Schedule Settings

**Route:** `/dashboard/schedule`

- Weekly grid showing working hours for each day
- Tap a day to edit start time, end time, break times, or mark the entire day as off
- "Days Off" section: calendar view where they can tap future dates to mark them as unavailable (vacation, holidays, etc.)
- For Business plan: select which staff member's schedule to edit from a dropdown at the top

#### 3f. Business Settings

**Route:** `/dashboard/settings`

- Edit business name, description, address, phone, logo
- View and copy booking link (with a "Share" button that opens native share dialog on mobile)
- Edit slug (with uniqueness validation)
- For Business plan: manage staff section
  - List all staff members
  - Add staff: name, phone (optional), photo (optional)
  - Deactivate staff (removes from booking page, keeps historical data)
  - Each staff member added = 1 seat for billing purposes

#### 3g. Business Dashboard / Stats (Business plan only)

**Route:** `/dashboard/stats`

Keep this simple for MVP. Show four cards at the top:

- Bookings this week (count)
- Revenue this week (sum of service prices for COMPLETED bookings)
- Bookings this month (count)
- Revenue this month (sum)

Below that, show:

- A simple bar chart: bookings per day for the last 7 days
- Busiest day of the week (based on historical bookings)
- Top 5 clients by visit count

### 4. Notifications (SMS)

Build an SMS service abstraction layer:

```typescript
interface SMSService {
  sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string }>;
}
```

For MVP, implement a `ConsoleSMSService` that logs to the console instead of actually sending SMS. This lets you build and test the entire notification flow without paying for SMS. The real provider gets plugged in later.

**Notification triggers:**

- **Booking confirmed:** Send immediately when a new booking is created. Message: "Your booking at {businessName} is confirmed. {serviceName} on {date} at {time}. Address: {address}"
- **24h reminder:** A cron job / scheduled task that runs every hour, finds all CONFIRMED bookings happening in 23-25 hours, and sends a reminder if one hasn't been sent yet (check Notification table). Message: "Reminder: You have a booking at {businessName} tomorrow at {time}. {serviceName}."
- **Cancellation:** Send immediately when a booking status changes to CANCELLED. Message: "Your booking at {businessName} on {date} at {time} has been cancelled."

Important: Always check the Notification table before sending to prevent duplicates. Write the notification record with status PENDING before attempting to send, then update to SENT or FAILED.

### 5. Plan & Seat Management

No real payment processing for MVP. Just enforce the rules:

- **Personal plan:** Maximum 1 staff member. When trying to add a second staff member, show a message: "Upgrade to Business to add team members."
- **Business plan:** Unlimited staff. Track seat count = count of active Staff records.
- Add a `plan` field on the Business model and check it in middleware/guards wherever features are plan-gated.
- Build a `/dashboard/billing` page that shows: current plan, number of active seats, and monthly total (seats × 15 AZN). For MVP this is informational only — no payment form.

**Plan-gated features:**
- Adding more than 1 staff member → Business only
- Stats dashboard → Business only
- All-staff calendar view → Business only

---

## API Routes

Structure these as Next.js API routes or a REST API. Use consistent patterns.

### Public (no auth required)
```
GET    /api/public/business/{slug}           → business info, services, staff for booking page
GET    /api/public/business/{slug}/slots      → available time slots (query params: staffId, serviceId, date)
POST   /api/public/bookings                   → create a booking (body: businessId, staffId, serviceId, date, startTime, clientName, clientPhone, notes?)
GET    /api/public/bookings/{id}              → booking confirmation details
```

### Auth
```
POST   /api/auth/send-otp        → send OTP to phone number
POST   /api/auth/verify-otp      → verify OTP, return JWT
```

### Protected (auth required)
```
GET    /api/dashboard/calendar     → bookings for date range (query: startDate, endDate, staffId?)
POST   /api/dashboard/bookings     → create manual booking
PATCH  /api/dashboard/bookings/{id} → update booking (status, notes, reschedule)

GET    /api/dashboard/services      → list services
POST   /api/dashboard/services      → create service
PATCH  /api/dashboard/services/{id} → update service
DELETE /api/dashboard/services/{id} → soft-delete (set isActive=false)

GET    /api/dashboard/clients          → list clients (query: search?, page?, limit?)
GET    /api/dashboard/clients/{id}     → client details with booking history
PATCH  /api/dashboard/clients/{id}     → update client notes

GET    /api/dashboard/staff             → list staff
POST   /api/dashboard/staff             → add staff member
PATCH  /api/dashboard/staff/{id}        → update staff
DELETE /api/dashboard/staff/{id}        → deactivate staff

GET    /api/dashboard/working-hours/{staffId} → get schedule
PUT    /api/dashboard/working-hours/{staffId} → replace full weekly schedule

GET    /api/dashboard/days-off/{staffId}  → list days off
POST   /api/dashboard/days-off            → add a day off
DELETE /api/dashboard/days-off/{id}       → remove a day off

GET    /api/dashboard/settings          → get business settings
PATCH  /api/dashboard/settings          → update business settings
GET    /api/dashboard/stats             → dashboard stats (Business plan only)
```

All protected routes must verify the JWT, look up the user's business, and scope all queries to that business. A professional can never see another business's data.

---

## Project Structure

```
bookla/
├── prisma/
│   ├── schema.prisma          (all models defined here)
│   └── seed.ts                (seed script with demo data — one barber with services, working hours, and a few bookings)
├── src/
│   ├── app/
│   │   ├── b/[slug]/          (public booking page)
│   │   │   └── page.tsx
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── onboarding/
│   │   │   └── page.tsx
│   │   ├── dashboard/
│   │   │   ├── page.tsx       (calendar — default view)
│   │   │   ├── services/
│   │   │   ├── clients/
│   │   │   ├── schedule/
│   │   │   ├── settings/
│   │   │   ├── stats/
│   │   │   └── billing/
│   │   └── api/
│   │       ├── auth/
│   │       ├── public/
│   │       └── dashboard/
│   ├── components/
│   │   ├── booking/           (public booking flow components)
│   │   ├── dashboard/         (dashboard UI components)
│   │   └── ui/                (shared UI primitives: Button, Input, Modal, etc.)
│   ├── lib/
│   │   ├── prisma.ts          (Prisma client singleton)
│   │   ├── auth.ts            (NextAuth config)
│   │   ├── slots.ts           (time slot calculation engine — THE critical business logic)
│   │   ├── sms.ts             (SMS service abstraction + console implementation)
│   │   └── utils.ts           (date helpers, formatters, slug generator)
│   └── types/
│       └── index.ts           (shared TypeScript types)
├── docker-compose.yml          (PostgreSQL + app)
├── .env.example
├── package.json
└── README.md
```

---

## Critical Implementation Notes

1. **Time slot engine is the heart of the app.** Build `lib/slots.ts` first and write thorough tests for it. Edge cases to handle: bookings that span the break time (reject), slots at the very end of the working day where the service would overflow past closing time (reject), multiple bookings on the same day (each must exclude the correct ranges), timezone handling for date boundaries.

2. **Overlap prevention must be atomic.** When creating a booking, use a database transaction. Inside the transaction: re-check that no conflicting booking exists for that staff+date+time range, THEN insert. This prevents race conditions where two clients book the same slot simultaneously.

3. **Slug uniqueness matters.** When auto-generating a slug from a business name, handle collisions by appending a short random suffix if the slug already exists. Validate slug format: lowercase, alphanumeric + hyphens only, 3-50 characters.

4. **Phone number normalization.** All phone numbers stored in E.164 format (+994XXXXXXXXX for Azerbaijan). Normalize on input — strip spaces, dashes, parentheses, handle "0" prefix (050 → +99450). Build a single `normalizePhone()` utility and use it everywhere.

5. **Price in minor units.** Store all prices in qəpik (1 AZN = 100 qəpik) to avoid floating point issues. Display with two decimal places on the frontend.

6. **Seed data.** Create a seed script that generates: one business ("Tural's Barbershop"), three services (Haircut 30min 15 AZN, Beard Trim 15min 8 AZN, Full Package 60min 25 AZN), working hours Mon-Sat 09:00-18:00 with 13:00-14:00 break, and 5 sample bookings spread across the next few days. This lets you immediately see the app working after setup.

7. **Mobile first.** Every page should be designed for 375px width first, then scale up. The calendar day view on mobile should be a simple vertical list of bookings, not a complex grid. The booking page will be used almost exclusively on mobile.

8. **Error handling.** Every API route should return consistent error shapes: `{ error: string, code: string }`. Common codes: SLOT_UNAVAILABLE, BUSINESS_NOT_FOUND, UNAUTHORIZED, PLAN_LIMIT_REACHED, VALIDATION_ERROR. The public booking page should handle SLOT_UNAVAILABLE gracefully — reload available slots and tell the client "That slot was just taken, please pick another."

---

## What NOT to Build

Do not build any of the following for MVP. They will come later:

- Online payment processing (no Stripe, no Kapital Bank integration)
- Client-side user accounts or login
- Email notifications (SMS only)
- Reviews or ratings system
- Service categories or packages
- Multi-location support
- Marketplace or discovery page where clients browse businesses
- Advanced analytics or reporting beyond the basic stats page
- Waitlist functionality
- Recurring/repeating bookings
- Multi-language support (build in English, localization comes later)
- Native mobile app (responsive web is the MVP)

---

## Development Order

Build in this sequence. Each step should be deployable and testable before moving to the next.

1. **Database + Prisma setup** — schema, migrations, seed script
2. **Auth** — phone+OTP login, session management, onboarding flow
3. **Service management** — CRUD for services (simple, builds confidence with the stack)
4. **Working hours + days off** — schedule settings UI and API
5. **Time slot engine** — `lib/slots.ts` with tests
6. **Public booking page** — the client-facing flow using the slot engine
7. **Calendar view** — the professional's day/week view showing bookings
8. **Manual booking** — add bookings from the dashboard
9. **Client list** — auto-populated from bookings, with history view
10. **Staff management** — add/remove staff (Business plan gate)
11. **Business settings** — edit profile, booking link sharing
12. **Notifications** — SMS abstraction, confirmation + reminder + cancellation
13. **Stats dashboard** — basic analytics (Business plan gate)
14. **Billing page** — informational plan/seat display
15. **Polish** — loading states, empty states, error handling, responsive tweaks