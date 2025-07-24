
import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "./Chat.css";

// The API_URL is now a relative path to your own server
const API_URL = "/api";

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
};

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuth();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (e, predefinedQuery = null) => {
    e.preventDefault();
    const query = predefinedQuery || input;
    if (!query.trim() || loading || !user) return;

    const newUserMessage = { role: "user", content: query };
    const currentMessages = messages.length === 0 && !loading ? [newUserMessage] : [...messages, newUserMessage];

    setMessages(currentMessages);
    setInput("");
    setLoading(true);

    try {
      const token = await user.getIdToken();
      const historyForBackend = currentMessages
        .filter((msg) => msg.role !== "system")
        .map(({ role, content }) => ({ role, content }));

      const response = await axios.post(
        `${API_URL}/query`, // <-- Now calls /api/query
        { text: query, history: historyForBackend },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const botMessage = { role: "assistant", content: response.data.reply };
      setMessages((prev) => [...prev, botMessage]);

    } catch (error) {
      const errorMessageText =
        error.response?.data?.error || "Failed to get response.";
      console.error("Chat error:", errorMessageText);
      if (error.response?.status === 401 || error.response?.status === 403) {
        logout();
      }
      const errorMessage = {
        role: "assistant",
        content: `Error: ${errorMessageText}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const examplePrompts = [
      "Jio plan under 500",
      "Airtel yearly plan with OTT",
      "Cheapest Vi plan with SMS",
      "Compare Jio and Airtel 28 day plans"
  ];

  return (
    <div className="chat-page-container">
        <aside className="chat-sidebar left-sidebar">
            <h3>Quick Info</h3>
            <div className="info-card">
                <h4>Example Prompts</h4>
                <ul>
                    {examplePrompts.map((prompt, index) => (
                        <li key={index} onClick={(e) => handleSend(e, prompt)}>
                            {prompt}
                        </li>
                    ))}
                </ul>
            </div>
        </aside>

        <div className="chat-container">
          <div className="chat-header">
            <div className="header-nav-icons">
              <Link to="/" className="nav-icon-btn" title="Home">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </Link>
              <Link to="/profile" className="nav-icon-btn" title="Profile">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </Link>
            </div>
            <h2>Plan Genie 🧞</h2>
            <button className="logout-button" onClick={logout}>
              Logout
            </button>
          </div>
          <div className="chat-messages">
            {messages.length === 0 && !loading && (
                <div className="greeting-container">
                    <h1 className="greeting-title">{getGreeting()}, {user?.displayName || 'there'}!</h1>
                    <p className="greeting-subtitle">How can I help you today?</p>
                </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message-wrapper ${msg.role === "user" ? "user-wrapper" : "bot-wrapper"}`}
              >
                <div className={`message ${msg.role === "user" ? "user" : "bot"}`}>
                  <p
                    style={{ whiteSpace: "pre-wrap" }}
                    dangerouslySetInnerHTML={{
                      __html: msg.content.replace(
                        /\*\*(.*?)\*\*/g,
                        "<strong>$1</strong>"
                      ),
                    }}
                  ></p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="message-wrapper bot-wrapper">
                <div className="message bot typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <form className="chat-input-form" onSubmit={handleSend}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., Jio plan under 500 for 3 months"
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>

        <aside className="chat-sidebar right-sidebar">
            <h3>💡 Genie's Tips</h3>
            <div className="tips-list">
                <div className="tip-item">You can easily port your number to a new operator.</div>
                <div className="tip-item">Yearly plans often offer significant savings.</div>
                <div className="tip-item">Check for 'unlimited 5G' offers from Jio and Airtel.</div>
            </div>
        </aside>
    </div>
  );
}

export default Chat;
