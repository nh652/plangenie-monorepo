
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Avatar,
  AppBar,
  Toolbar,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Send as SendIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
  AccountCircle,
  Clear as ClearIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [lastFilters, setLastFilters] = useState(null);
  const [lastOffset, setLastOffset] = useState(null);
  const messagesEndRef = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Load chat history from localStorage
    const savedHistory = localStorage.getItem('chatHistory');
    if (savedHistory) {
      setMessages(JSON.parse(savedHistory));
    } else {
      // Initial welcome message
      setMessages([
        {
          id: 1,
          type: 'bot',
          content: 'Hi there! 👋 I\'m PlanGenie, your telecom plan assistant. I can help you find the perfect mobile plan. Try asking me something like "Show me Jio plans under ₹400" or "I need a data-only plan for 2 months".',
          timestamp: new Date()
        }
      ]);
    }
  }, []);

  useEffect(() => {
    // Save chat history to localStorage whenever messages change
    if (messages.length > 0) {
      localStorage.setItem('chatHistory', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (text = input, isMoreRequest = false) => {
    if (!text.trim() && !isMoreRequest) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: text,
      timestamp: new Date()
    };

    if (!isMoreRequest) {
      setMessages(prev => [...prev, userMessage]);
      setInput('');
    }

    setLoading(true);

    try {
      const requestBody = isMoreRequest 
        ? { text: 'more', lastFilters, lastOffset }
        : { text };

      const response = await axios.post('/query', requestBody);
      const { reply, filters, offset, plans, nextOffset } = response.data;

      setLastFilters(filters);
      setLastOffset(nextOffset);

      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: reply,
        timestamp: new Date(),
        plans: plans || [],
        hasMore: nextOffset !== null
      };

      setMessages(prev => isMoreRequest ? [...prev, botMessage] : [...prev, botMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: error.response?.data?.error || 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 1,
        type: 'bot',
        content: 'Chat cleared! How can I help you find a mobile plan today?',
        timestamp: new Date()
      }
    ]);
    setLastFilters(null);
    setLastOffset(null);
    localStorage.removeItem('chatHistory');
    setAnchorEl(null);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar position="static" color="primary">
        <Toolbar>
          <BotIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            PlanGenie Assistant
          </Typography>
          <IconButton color="inherit" onClick={handleMenuOpen}>
            <AccountCircle />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={() => navigate('/profile')}>Profile</MenuItem>
            <MenuItem onClick={clearChat}>Clear Chat</MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Chat Messages */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2, bgcolor: '#f5f5f5' }}>
        <Container maxWidth="md">
          {messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                mb: 2,
                justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              {message.type === 'bot' && (
                <Avatar sx={{ mr: 1, bgcolor: 'primary.main' }}>
                  <BotIcon />
                </Avatar>
              )}
              <Paper
                sx={{
                  p: 2,
                  maxWidth: '70%',
                  bgcolor: message.type === 'user' ? 'primary.main' : 'white',
                  color: message.type === 'user' ? 'white' : 'text.primary',
                  borderRadius: message.type === 'user' ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
                  ...(message.isError && { bgcolor: 'error.light', color: 'white' })
                }}
              >
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                </Typography>
                
                {message.plans && message.plans.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    {message.plans.map((plan, index) => (
                      <Chip
                        key={index}
                        label={`₹${plan.price} - ${plan.data || 'N/A'} - ${plan.validity}`}
                        variant="outlined"
                        size="small"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                )}
                
                {message.hasMore && (
                  <Box sx={{ mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => sendMessage('', true)}
                      disabled={loading}
                    >
                      Show More Plans
                    </Button>
                  </Box>
                )}
                
                <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.7 }}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </Typography>
              </Paper>
              {message.type === 'user' && (
                <Avatar sx={{ ml: 1, bgcolor: 'secondary.main' }}>
                  <PersonIcon />
                </Avatar>
              )}
            </Box>
          ))}
          
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
              <Avatar sx={{ mr: 1, bgcolor: 'primary.main' }}>
                <BotIcon />
              </Avatar>
              <Paper sx={{ p: 2, bgcolor: 'white' }}>
                <CircularProgress size={20} />
                <Typography variant="body2" sx={{ ml: 1, display: 'inline' }}>
                  Thinking...
                </Typography>
              </Paper>
            </Box>
          )}
          
          <div ref={messagesEndRef} />
        </Container>
      </Box>

      {/* Input Area */}
      <Paper sx={{ p: 2, m: 2, mt: 0 }} elevation={3}>
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              placeholder="Ask me about mobile plans..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              multiline
              maxRows={4}
            />
            <Button
              variant="contained"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              sx={{ minWidth: '60px', height: '56px' }}
            >
              <SendIcon />
            </Button>
          </Box>
        </Container>
      </Paper>
    </Box>
  );
};

export default Chat;
