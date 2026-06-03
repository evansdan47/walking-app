import { SITE_NAME } from "./site";

/** Primary landing page — tune copy before launch. */
export const LANDING_SEO = {
  title: `${SITE_NAME} — Walking & hiking app | Plan routes, navigate offline`,
  description:
    "Plan walking and hiking routes on the web, follow trails with off-path alerts, and record every walk with GPS, photos and stats. Join the newsletter for closed beta access.",
  /** Shorter variant for OG / Twitter when space is tight. */
  shortTitle: `${SITE_NAME} — Plan, follow and record every walk`,
  keywords: [
    "walking app",
    "hiking app",
    "route planner",
    "trail navigation",
    "offline maps",
    "GPS walk recorder",
    "hiking routes UK",
    "walking routes",
  ],
  h1: "Plan, follow and record every walk",
  intro:
    "Rambleio is a walking and hiking companion: build routes on the web, stay on track with gentle off-path alerts, and capture every outing with GPS, photos and stats — even offline on the trail.",
} as const;

export const NEWSLETTER_SEO = {
  title: "Newsletter & early access",
  description:
    "Sign up for Rambleio updates and closed beta access. Tell us how you walk and help shape a simpler app for planning, navigation and recording hikes.",
  h1: "Sign up to the Rambleio newsletter",
} as const;
