CREATE TABLE "posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "title" text NOT NULL,
  "url" text NOT NULL UNIQUE,
  "description" text,
  "published_at" timestamp,
  "feed_id" uuid NOT NULL REFERENCES "feeds"("id") ON DELETE CASCADE
);
