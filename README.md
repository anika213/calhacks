# 🧠 ElderCare Cognitive & Connection Platform

> An empathetic, accessible app designed to help elderly individuals track cognitive health, combat loneliness, and reconnect with loved ones through engaging activities and social features.

---

## 📖 Inspiration

After heartfelt conversations with our grandparents and other elderly individuals, we learned that **loneliness**, **lack of purpose**, and **cognitive decline** are among the most challenging aspects of aging. These conversations inspired us to create a compassionate, user-friendly solution that:

- Helps track cognitive and emotional health
- Facilitates meaningful connections with loved ones and peers
- Provides an engaging, accessible experience for all users

---

## ✨ Features

### 🎮 Daily Brain & Mood Games
Interactive exercises inspired by clinical assessments like the **Stroop Test** and **List Recall** games to evaluate:
- Attention span
- Memory retention
- Reaction speed
- Cognitive flexibility

### 📊 Progress Tracking Dashboard
Intuitive visual summaries that display:
- Performance trends over time
- Cognitive improvement metrics
- Mood tracking insights

### 🤝 Connection Mode
A **social circle feature** enabling users to:
- Share game results with family and friends
- Send messages and stay connected
- Build a supportive community

### 🎲 Multiplayer Games with LLM Facilitation
- Play cooperatively or competitively with friends
- AI-powered game host provides conversational, friendly guidance
- Adaptive difficulty based on player performance

### ♿ Accessibility for the Visually Impaired
- **Fish Audio API** integration for speech-based interactions
- Audio feedback for all tasks and game results
- Full accessibility for users with limited vision

---

## 🛠️ Tech Stack

**Frontend**
- React Native (cross-platform mobile: iOS & Android)

**Backend**
- Node.js
- Express.js
- JWT authentication for secure sessions

**Database**
- MongoDB (scalable, secure user data storage)

**AI & Audio**
- JanitorAI API (conversational game facilitation)
- Fish Audio API (text-to-speech for accessibility)

**Additional Tools**
- Real-time communication for multiplayer features
- Adaptive LLM prompts for personalized difficulty

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- npm or yarn
- React Native development environment

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/eldercare-app.git
cd eldercare-app
```

2. **Install backend dependencies**
```bash
cd backend
npm install
```

3. **Install frontend dependencies**
```bash
cd ../frontend
npm install
```

4. **Configure environment variables**
Create a `.env` file in the backend directory:
```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JANITOR_AI_API_KEY=your_janitorai_key
FISH_AUDIO_API_KEY=your_fish_audio_key
PORT=8000
```

5. **Start the backend server**
```bash
cd backend
npm start
```

6. **Start the React Native app**
```bash
cd frontend
npm start
# For iOS
npm run ios
# For Android
npm run android
```

---

## 📱 Usage

1. **Create an account** or log in
2. **Complete daily brain games** to track cognitive performance
3. **Check your dashboard** for progress insights
4. **Connect with family** through the social circle feature
5. **Play multiplayer games** with friends using the LLM-facilitated game mode

---

## 🔧 Challenges We Overcame

### Accessibility Design
Ensuring games were equally usable for both sighted and visually impaired users required extensive experimentation with audio feedback timing and clarity.

### LLM Integration
Calibrating the language model to act as a friendly, helpful "game host" without overwhelming or confusing users was a significant UX challenge that required careful prompt engineering.

### Data Visualization
Creating intuitive, non-overwhelming visual representations of cognitive trends for older users took multiple design iterations and user testing.

---

## 💡 What We Learned

- How **technology can bridge generational gaps** when designed with empathy and accessibility as core principles
- Best practices for integrating **audio-based AI models** for accessibility
- Techniques for **real-time multiplayer state management**
- The importance of **designing for underserved user demographics**

## 🙏 Acknowledgments

- Our grandparents and elderly community members who shared their experiences
- Fish Audio for accessibility API support
- JanitorAI for conversational AI capabilities
- The open-source community for invaluable tools and resources
