// Database schema (idempotent; applied on every cold start). Keep in sync with docs/SETUP.md.
export const SCHEMA_SQL = `
-- SEVCP Office Hours schema. Idempotent: runs on every cold start (CREATE ... IF NOT EXISTS).
-- Timestamps are stored in UTC (timestamptz); the booking's display time zone is kept alongside.

CREATE TABLE IF NOT EXISTS settings (
  id                            integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  host_email                    text,
  calendar_id                   text NOT NULL DEFAULT 'primary',
  timezone                      text NOT NULL DEFAULT 'Africa/Lagos',
  appointment_duration_minutes  integer NOT NULL DEFAULT 30 CHECK (appointment_duration_minutes BETWEEN 10 AND 240),
  -- {"mon":[["09:00","17:00"]], ... "sat":[], "sun":[]}
  availability_rules            jsonb NOT NULL DEFAULT '{"mon":[["11:00","15:00"]],"tue":[["11:00","15:00"]],"wed":[["11:00","15:00"]],"thu":[["11:00","15:00"]],"fri":[["11:00","15:00"]],"sat":[],"sun":[]}',
  minimum_notice_hours          integer NOT NULL DEFAULT 4 CHECK (minimum_notice_hours >= 0),
  maximum_booking_days          integer NOT NULL DEFAULT 60 CHECK (maximum_booking_days BETWEEN 1 AND 365),
  maximum_bookings_per_day      integer NOT NULL DEFAULT 2 CHECK (maximum_bookings_per_day >= 1),
  buffer_minutes                integer NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS attendees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text NOT NULL,
  role        text NOT NULL CHECK (role IN ('host', 'cohost')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS is_optional boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS attendees_email_uq ON attendees (lower(email));
-- At most one active host.
CREATE UNIQUE INDEX IF NOT EXISTS attendees_one_host ON attendees (role) WHERE role = 'host' AND is_active;

CREATE TABLE IF NOT EXISTS bookings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name               text NOT NULL,
  surname                  text NOT NULL,
  email                    text NOT NULL,
  startup_name             text NOT NULL,
  session_notes            text,
  start_at                 timestamptz NOT NULL,
  end_at                   timestamptz NOT NULL CHECK (end_at > start_at),
  timezone                 text NOT NULL,
  status                   text NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'failed')),
  google_event_id          text NOT NULL UNIQUE,      -- deterministic, set before the API call (retry-safe)
  google_meet_url          text,
  cancellation_token_hash  text NOT NULL,
  idempotency_key          text UNIQUE,
  cancelled_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_start_idx ON bookings (start_at);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status);

-- Snapshot of who was invited, so history survives later changes to the co-host list.
CREATE TABLE IF NOT EXISTS booking_attendees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  name        text,
  email       text NOT NULL,
  role        text NOT NULL CHECK (role IN ('host', 'cohost', 'founder')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE booking_attendees ADD COLUMN IF NOT EXISTS is_optional boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS booking_attendees_booking_idx ON booking_attendees (booking_id);

-- Slot locks. The exclusion constraint makes overlapping holds impossible at the database
-- level (two concurrent bookings for one slot: exactly one INSERT succeeds). A reschedule
-- holds the new slot alongside the old one until the calendar update succeeds.
CREATE TABLE IF NOT EXISTS reservations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  slot        tstzrange NOT NULL,     -- includes buffer on both sides
  local_day   date NOT NULL,          -- calendar day in the booking time zone (per-day caps)
  kind        text NOT NULL CHECK (kind IN ('booking', 'reschedule')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservations_no_overlap EXCLUDE USING gist (slot WITH &&)
);
CREATE INDEX IF NOT EXISTS reservations_day_idx ON reservations (local_day);

CREATE TABLE IF NOT EXISTS booking_operations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     uuid REFERENCES bookings(id) ON DELETE CASCADE,
  operation_type text NOT NULL CHECK (operation_type IN ('create_event', 'cancel_event', 'reschedule_event', 'cleanup_event')),
  status         text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
  attempt_count  integer NOT NULL DEFAULT 0,
  payload        jsonb,
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_operations_status_idx ON booking_operations (status);

-- Integration problems an admin must act on (e.g. a co-host's calendar can't be read).
CREATE TABLE IF NOT EXISTS integration_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL,
  subject     text,
  message     text NOT NULL,
  resolved    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS integration_events_open_idx ON integration_events (resolved, created_at DESC);

-- The connected Google account (calendar owner). Refresh token is AES-256-GCM encrypted.
CREATE TABLE IF NOT EXISTS google_credentials (
  id                       integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  account_email            text NOT NULL,
  refresh_token_encrypted  text NOT NULL,
  scopes                   text NOT NULL,
  connected_at             timestamptz NOT NULL DEFAULT now()
);

-- Fixed-window rate limiting for public endpoints (keyed by hashed IP + route).
CREATE TABLE IF NOT EXISTS rate_limits (
  key           text NOT NULL,
  window_start  timestamptz NOT NULL,
  count         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
`;
