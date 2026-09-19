import React from 'react';
import { ArrowRight, ArrowUpRight, Sparkles, MessageCircle, CalendarDays, BookOpen, Check, Heart } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useVenue } from '@/lib/VenueContext';
import { Link } from 'react-router-dom';
import './landing.css';

const features = [
  { icon: MessageCircle, title: 'A thoughtful first hello.', text: 'Help couples explore your venue, discover packages, and get answers to the questions that matter.' },
  { icon: CalendarDays, title: 'Make the next step easy.', text: 'Bring availability, budget exploration, and tour scheduling into one seamless conversation.' },
  { icon: BookOpen, title: 'Your expertise, always close.', text: 'Give your planner venue-specific knowledge, review conversations, and keep your team in the loop.' }
];

export default function LandingPage() {
  const { user } = useVenue();
  const signIn = () => base44.auth.redirectToLogin(new URL('/Dashboard', window.location.origin).href);
  const action = (className, label = 'Sign in to your workspace') => user
    ? <Link className={className} to="/Dashboard">Open your dashboard <ArrowRight size={17} aria-hidden="true" /></Link>
    : <button className={className} onClick={signIn}>{label} <ArrowRight size={17} aria-hidden="true" /></button>;

  return (
    <div className="vp-landing">
      <a className="vp-skip" href="#main-content">Skip to content</a>
      <header className="vp-header vp-container">
        <a href="/" className="vp-brand" aria-label="Virtual Planner home"><span className="vp-brand-mark"><Sparkles size={22} aria-hidden="true" /></span> Virtual Planner<span className="vp-brand-dot">.</span></a>
        <nav aria-label="Main navigation">
          <a className="vp-nav-link" href="#features">The experience</a>
          {action('vp-nav-signin', 'Sign in')}
        </nav>
      </header>
      <main id="main-content">
        <section className="vp-hero vp-container">
          <div className="vp-hero-copy">
            <p className="vp-eyebrow"><span /> BUILT FOR WEDDING VENUES</p>
            <h1>Every great day<br />starts with a<br /><em>little connection.</em></h1>
            <p className="vp-intro">Meet the virtual planner that welcomes your couples, answers their questions, and helps turn “what if” into “let’s take a look.”</p>
            <div className="vp-hero-actions">{action('vp-button')}<a href="#features" className="vp-text-link">Explore the experience <ArrowUpRight size={16} aria-hidden="true" /></a></div>
            <p className="vp-caption">Your venue. Your knowledge. A more personal first impression.</p>
          </div>
          <div className="vp-scene">
            <div className="vp-arch">
              <div className="vp-scene-top"><span className="vp-tiny-star">✧</span><span>A WARM WELCOME,<br />BEFORE THE FIRST VISIT.</span></div>
              <div className="vp-chat-preview" aria-label="Illustrative planner conversation">
                <div className="vp-chat-heading"><span className="vp-chat-icon"><Sparkles size={20} aria-hidden="true" /></span><div><strong>Your virtual planner</strong><span>Good questions. Thoughtful answers.</span></div><span className="vp-online" /></div>
                <div className="vp-chat-body">
                  <span className="vp-demo-label">A LITTLE PREVIEW</span>
                  <div className="vp-bubble vp-bubble-guest">We found our dream venue. Where do we start?</div>
                  <div className="vp-bubble vp-bubble-planner">With what matters to you. Let’s explore the spaces, talk through your plans, and find a time to visit. <Heart size={13} aria-hidden="true" /></div>
                  <div className="vp-preview-options"><span>Explore packages</span><span>Plan a visit <ArrowUpRight size={12} aria-hidden="true" /></span></div>
                </div>
                <div className="vp-preview-footer"><span>Something wonderful starts here</span><ArrowRight size={16} aria-hidden="true" /></div>
              </div>
              <div className="vp-scene-bottom"><span className="vp-check"><Check size={15} aria-hidden="true" /></span> More connection. Less back-and-forth.</div>
            </div>
            <div className="vp-orbit" aria-hidden="true">✳</div>
            <span className="vp-scene-note">a little help, a lot of possibility</span>
          </div>
        </section>
        <section className="vp-features" id="features">
          <div className="vp-container">
            <div className="vp-section-heading"><p className="vp-eyebrow">THOUGHTFUL FROM THE VERY FIRST CLICK</p><h2>More time for the moments<br />only you can create.</h2><p>Let your planner handle the early questions, so your team can focus on building real relationships.</p></div>
            <div className="vp-feature-grid">{features.map(({ icon: Icon, title, text }, index) => <article key={title}><div className="vp-feature-top"><Icon size={25} strokeWidth={1.4} aria-hidden="true" /><span>0{index + 1}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div>
          </div>
        </section>
        <section className="vp-welcome vp-container">
          <div><p className="vp-eyebrow">A SPACE FOR YOUR TEAM</p><h2>Your next great connection<br />is waiting.</h2><p>Sign in to manage your planner, review conversations, and keep your venue’s details up to date.</p>{action('vp-button')}</div>
          <aside><Heart size={22} strokeWidth={1.4} aria-hidden="true" /><h3>Planning your own celebration?</h3><p>Your venue has a planner just for you. Visit your venue’s website or use the planner link they shared to explore the details of your day.</p></aside>
        </section>
      </main>
      <footer className="vp-footer vp-container"><a className="vp-brand" href="/">Virtual Planner<span className="vp-brand-dot">.</span></a><span>Good beginnings. Beautiful possibilities.</span><span>© {new Date().getFullYear()} Virtual Planner</span></footer>
    </div>
  );
}
