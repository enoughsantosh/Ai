const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Enable Google Search Tool
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-8b",
  tools: [
    {
      google_search_retrieval: {
        dynamic_retrieval_config: {
          mode: "MODE_DYNAMIC",
          dynamic_threshold: 0.3,
        },
      },
    },
  ],
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

// In-memory chat history
const chatHistories = {};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Only POST requests are allowed.");
  }

  const { sessionId, userMessage } = req.body;

  if (!sessionId || !userMessage) {
    return res.status(400).json({ error: "sessionId and userMessage are required." });
  }

  try {
    // Initialize chat history for session if not exists
    if (!chatHistories[sessionId]) {
      chatHistories[sessionId] = [];
    }

    // Add user's message to history
    chatHistories[sessionId].push({ role: "user", parts: [{ text: userMessage }] });

    // Start a chat session with full history
    const chatSession = model.startChat({
      generationConfig,
      history: chatHistories[sessionId],
    });

    // Get response from AI (search-enabled)
    const result = await chatSession.sendMessage(userMessage);

    // Extract AI response
    const aiResponse = result.response.text();
    chatHistories[sessionId].push({ role: "model", parts: [{ text: aiResponse }] });

    // Extract token usage info
    const tokensUsed = result.response.metadata?.tokensUsed || "N/A";
    const tokensLeft = generationConfig.maxOutputTokens - tokensUsed;

    res.status(200).json({
      response: aiResponse,
      tokensUsed,
      tokensLeft: tokensLeft >= 0 ? tokensLeft : "N/A",
    });
  } catch (error) {
    console.error("Error generating AI response:", error);
    res.status(500).json({ error: "Failed to generate response." });
  }
};
