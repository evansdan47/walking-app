'use client';

import { useMutation } from 'convex/react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '../../../convex/_generated/api';

// ── Question option sets ────────────────────────────────────────────────────

const WALKING_FREQUENCY_OPTIONS = [
  'Daily',
  'Several times per week',
  'Once a week',
  'A few times per month',
  'Occasionally',
  'Rarely',
] as const;

const WALKING_TYPE_OPTIONS = [
  'Short local walks (under 3 miles / 5 km)',
  'Countryside walks',
  'Coastal walks',
  'Hillwalking / mountain walking',
  'Long-distance trails',
  'Dog walking',
  'Group walks',
  'Other',
] as const;

const APPS_USED_OPTIONS = [
  'None',
  'OS Maps',
  'AllTrails',
  'Komoot',
  'Outdooractive',
  'Strava',
  'Garmin',
  'Google Maps',
  'Paper maps',
  'Other',
] as const;

const MAIN_USES_OPTIONS = [
  'Finding new routes',
  'Route planning',
  'Navigation / staying on route',
  'Recording walks',
  'Tracking fitness statistics',
  'Taking photos and memories',
  'Sharing walks with others',
  'Group walks',
  'Offline maps',
] as const;

const FRUSTRATION_OPTIONS = [
  'Too complicated',
  'Too expensive',
  'Poor offline support',
  'Battery drain',
  'Difficult route planning',
  'Poor route guidance',
  'Too focused on fitness',
  'Poor map quality',
  'Lack of community features',
  'Nothing in particular',
] as const;

const TESTING_INTEREST_OPTIONS = [
  'Yes, I\'d like early access to new builds',
  'Yes, and I\'m happy to provide feedback regularly',
  'Yes, and I\'d be willing to join occasional video calls',
  'Maybe',
  'No, I only want updates',
] as const;

const DEVICE_TYPE_OPTIONS = [
  'iPhone',
  'Android phone',
  'Garmin watch',
  'Apple Watch',
  'Samsung Galaxy Watch',
  'Other smartwatch',
  'Paper map only',
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function toggle(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ number, title, hint }: { number: number; title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-gray-800">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold mr-2">
          {number}
        </span>
        {title}
      </h2>
      {hint && <p className="mt-0.5 ml-7 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function CheckboxGroup({
  options,
  selected,
  onChange,
  maxSelect,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  maxSelect?: number;
}) {
  return (
    <div className="ml-7 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {options.map((opt) => {
        const checked = selected.includes(opt);
        const disabled = !checked && maxSelect !== undefined && selected.length >= maxSelect;
        return (
          <label
            key={opt}
            className={`flex items-center gap-2 text-sm rounded-md px-2.5 py-1.5 cursor-pointer select-none transition-colors
              ${checked ? 'bg-green-50 text-green-800 ring-1 ring-green-300' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'}
              ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <input
              type="checkbox"
              className="accent-green-600 h-3.5 w-3.5 flex-shrink-0"
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(toggle(selected, opt))}
            />
            {opt}
          </label>
        );
      })}
    </div>
  );
}

function RadioGroup({
  options,
  selected,
  onChange,
}: {
  options: readonly string[];
  selected: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="ml-7 flex flex-col gap-1.5">
      {options.map((opt) => (
        <label
          key={opt}
          className={`flex items-center gap-2 text-sm rounded-md px-2.5 py-1.5 cursor-pointer select-none transition-colors
            ${selected === opt ? 'bg-green-50 text-green-800 ring-1 ring-green-300' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'}`}
        >
          <input
            type="radio"
            className="accent-green-600 h-3.5 w-3.5 flex-shrink-0"
            checked={selected === opt}
            onChange={() => onChange(opt)}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function WaitlistPage() {
  const register = useMutation(api.waitlist.register);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [walkingFrequency, setWalkingFrequency] = useState('');
  const [walkingTypes, setWalkingTypes] = useState<string[]>([]);
  const [appsUsed, setAppsUsed] = useState<string[]>([]);
  const [mainUses, setMainUses] = useState<string[]>([]);
  const [frustrations, setFrustrations] = useState<string[]>([]);
  const [testingInterest, setTestingInterest] = useState('');
  const [deviceTypes, setDeviceTypes] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError('Please enter your name and email address.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        walkingFrequency: walkingFrequency || undefined,
        walkingTypes: walkingTypes.length ? walkingTypes : undefined,
        appsUsed: appsUsed.length ? appsUsed : undefined,
        mainUses: mainUses.length ? mainUses : undefined,
        frustrations: frustrations.length ? frustrations : undefined,
        testingInterest: testingInterest || undefined,
        deviceTypes: deviceTypes.length ? deviceTypes : undefined,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">You&rsquo;re on the list!</h1>
          <p className="text-sm text-gray-600 mb-6">
            Thanks for your interest in Rambleio. We&rsquo;ll be in touch when open beta launches.
          </p>
          <Link
            href="/"
            className="text-sm text-green-700 hover:text-green-800 font-medium"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gray-50">

      {/* Hero image — covers the top of the page, fades into bg */}
      <div className="absolute top-0 left-0 right-0 h-130 overflow-hidden">
        <Image
          src="/landscapebackground.png"
          alt="Rambleio — rolling hills and river valley at sunrise"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/20 via-transparent to-gray-50" />
      </div>

      {/* Content flows over the image then continues on gray-50 */}
      <div className="relative max-w-2xl mx-auto px-4 pt-50 pb-16">

        {/* Info panel */}
        <div className="bg-black/30 backdrop-blur-sm rounded-2xl px-6 py-5 mb-6">
          <div className="flex items-center gap-4 mb-2">
            <Image
              src="/Logo.png"
              alt="Rambleio"
              width={56}
              height={56}
              className="h-14 w-14 shrink-0"
              priority
            />
            <h1 className="text-2xl font-bold text-white">Sign up to the Rambleio newsletter</h1>
          </div>
          <p className="text-sm text-white/85">
            Rambleio is currently in closed beta. Sign up below and we&rsquo;ll keep you updated on our progress and let you know when open beta launches.
            The optional questions help us build the best possible app for walkers like you.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 divide-y divide-gray-100">

            {/* Name & email */}
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Your name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Q1 */}
            <div className="p-6">
              <SectionHeading number={1} title="How often do you go walking or hiking?" />
              <RadioGroup
                options={WALKING_FREQUENCY_OPTIONS}
                selected={walkingFrequency}
                onChange={setWalkingFrequency}
              />
            </div>

            {/* Q2 */}
            <div className="p-6">
              <SectionHeading number={2} title="What type of walking do you do most often?" />
              <CheckboxGroup
                options={WALKING_TYPE_OPTIONS}
                selected={walkingTypes}
                onChange={setWalkingTypes}
              />
            </div>

            {/* Q3 */}
            <div className="p-6">
              <SectionHeading number={3} title="Which apps or tools do you currently use when walking?" />
              <CheckboxGroup
                options={APPS_USED_OPTIONS}
                selected={appsUsed}
                onChange={setAppsUsed}
              />
            </div>

            {/* Q4 */}
            <div className="p-6">
              <SectionHeading
                number={4}
                title="What do you mainly use walking apps for?"
                hint="Select up to 3"
              />
              <CheckboxGroup
                options={MAIN_USES_OPTIONS}
                selected={mainUses}
                onChange={setMainUses}
                maxSelect={3}
              />
            </div>

            {/* Q5 */}
            <div className="p-6">
              <SectionHeading number={5} title="What frustrates you most about current walking apps?" />
              <CheckboxGroup
                options={FRUSTRATION_OPTIONS}
                selected={frustrations}
                onChange={setFrustrations}
              />
            </div>

            {/* Q6 */}
            <div className="p-6">
              <SectionHeading number={6} title="Would you be interested in helping test new features?" />
              <RadioGroup
                options={TESTING_INTEREST_OPTIONS}
                selected={testingInterest}
                onChange={setTestingInterest}
              />
            </div>

            {/* Bonus */}
            <div className="p-6">
              <SectionHeading number={7} title="What device do you normally walk with?" />
              <CheckboxGroup
                options={DEVICE_TYPE_OPTIONS}
                selected={deviceTypes}
                onChange={setDeviceTypes}
              />
            </div>

            {/* Submit */}
            <div className="p-6">
              {error && (
                <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 ring-1 ring-red-200">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Submitting…' : 'Sign up to the newsletter'}
              </button>
              <p className="mt-3 text-center text-xs text-gray-400">
                Already have an account?{' '}
                <Link href="/sign-in" className="text-green-700 hover:text-green-800 font-medium">
                  Sign in
                </Link>
              </p>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
