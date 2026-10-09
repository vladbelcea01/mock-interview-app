CREATE TYPE "public"."recommendation" AS ENUM('STRONG_HIRE', 'HIRE', 'NO_HIRE', 'STRONG_NO_HIRE');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'INTERVIEWER');--> statement-breakpoint
CREATE TYPE "public"."seniority" AS ENUM('JUNIOR', 'MID', 'SENIOR');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."session_type" AS ENUM('CODING', 'SYSTEM_DESIGN', 'BEHAVIORAL', 'TECHNICAL');--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"overall_rating" integer NOT NULL,
	"problem_solving" integer NOT NULL,
	"communication" integer NOT NULL,
	"technical_depth" integer NOT NULL,
	"code_quality" integer NOT NULL,
	"recommendation" "recommendation" NOT NULL,
	"strengths" text NOT NULL,
	"improvements" text NOT NULL,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"type" "session_type" NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL,
	"status" "session_status" DEFAULT 'SCHEDULED' NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"participant_id" uuid NOT NULL,
	"interviewer_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"email" varchar(254) NOT NULL,
	"target_role" varchar(120) NOT NULL,
	"seniority" "seniority" NOT NULL,
	"notes" text,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(120) NOT NULL,
	"role" "role" DEFAULT 'INTERVIEWER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_session_id_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_interviewer_id_users_id_fk" FOREIGN KEY ("interviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_session_id_key" ON "feedback" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "feedback_strengths_trgm_idx" ON "feedback" USING gin ("strengths" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "feedback_improvements_trgm_idx" ON "feedback" USING gin ("improvements" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "session_interviewer_scheduled_idx" ON "interview_sessions" USING btree ("interviewer_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "session_participant_scheduled_idx" ON "interview_sessions" USING btree ("participant_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "session_status_idx" ON "interview_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "session_title_trgm_idx" ON "interview_sessions" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "participants_email_key" ON "participants" USING btree ("email");--> statement-breakpoint
CREATE INDEX "participant_fullname_trgm_idx" ON "participants" USING gin ("full_name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");