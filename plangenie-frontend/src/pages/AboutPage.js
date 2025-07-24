import React from 'react';
import './AboutPage.css';

function AboutPage() {
  return (
    <div className="about-page">
      <div className="about-container">
        <h1>About PlanGenie</h1>
        <p>
          PlanGenie was born from a simple frustration: finding the right mobile plan in India is complicated. With dozens of operators and hundreds of ever-changing plans, making an informed choice is a challenge.
        </p>
        <p>
          We decided to solve this problem using the power of conversational AI. Instead of you having to learn the telco jargon, we built a bot that learns your needs. Our AI assistant is trained on up-to-date plan data and is designed to understand natural language, provide reasoned comparisons, and help you find the best value, effortlessly.
        </p>
        <h2>Our Mission</h2>
        <p>
          Our mission is to simplify decision-making for Indian consumers through intelligent, easy-to-use tools. PlanGenie is our first step towards that goal.
        </p>
      </div>
    </div>
  );
}

export default AboutPage;