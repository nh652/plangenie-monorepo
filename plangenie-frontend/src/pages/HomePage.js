import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

function HomePage() {
  return (
    <div className="homepage">
      <section className="hero-section">
        <div className="hero-content">
          <h1>Find Your Perfect Mobile Plan, Instantly.</h1>
          <p className="subtitle">
            Stop scrolling through endless telco websites. Tell PlanGenie what you need, and get smart, personalized recommendations in seconds.
          </p>
          <Link to="/chat" className="cta-button">
            Start Chatting Now
          </Link>
        </div>
      </section>

      <section className="features-section">
        <h2>How It Works</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>1. Just Ask</h3>
            <p>Simply type what you're looking for in plain English. For example, "Jio plan under 500 with lots of data."</p>
          </div>
          <div className="feature-card">
            <h3>2. Get Smart Answers</h3>
            <p>Our AI understands your needs, compares hundreds of plans, and gives you reasoned recommendations, not just a list.</p>
          </div>
          <div className="feature-card">
            <h3>3. Compare & Decide</h3>
            <p>Ask follow-up questions, compare options, and find the absolute best value for your money. It's that simple.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
export default HomePage;