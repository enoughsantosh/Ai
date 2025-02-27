const { DynamicRetrievalMode,
  GoogleGenerativeAI, } = require("@google/generative-ai");
require("dotenv").config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-8b",
  systemInstruction: "friendly,funny, Genz style,expression,minimum words",
  tools: [
    {
      googleSearchRetrieval: {
        dynamicRetrievalConfig: {
          mode: DynamicRetrievalMode.MODE_DYNAMIC,
          dynamicThreshold: 0.7,
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

// Simple in-memory storage for chat history
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
    // Initialize chat history for the session if it doesn't exist
    if (!chatHistories[sessionId]) {
      chatHistories[sessionId] = [
        { role: "user", parts: [{ text: "hii bro" }] },
        { role: "model", parts: [{ text: "Hey bestie!  What's up? ✨\n" }] },
        { role: "user", parts: [{ text: "cute asf" }] },
        { role: "model", parts: [{ text: "OMG, thanks!  You're too kind!  🥰  Spill the tea.  What's good?\n" }] },
        { role: "user", parts: [{ text: "coffee?" }] },
        { role: "model", parts: [{ text: "Coffee, you say?  ☕️  Sounds like a vibe." }] },
        { role: "user", parts: [{ text: "intresting" }] },
        { role: "model", parts: [{ text: "Yeah, pretty interesting, right?  😎 Whatcha into?\n" }] },
      ];
    }

    // Add the user's new message to the history  
    chatHistories[sessionId].push({ role: "user", parts: [{ text: userMessage }] });  

    // Start a chat session with the full history  
    const chatSession = model.startChat({  
      generationConfig,  
      history: chatHistories[sessionId],  
    });  

    // Get the response from Gemini with the search tool
    const result = await chatSession.sendMessage(userMessage);
    
    // Extract the text response properly - it might be structured differently with tools
    let responseText;
    
    // Check if the response has candidates from search results
    if (result.response.candidates && result.response.candidates.length > 0) {
      responseText = result.response.candidates[0].content.parts[0].text;
    } else {
      // Fall back to the standard method if no candidates
      responseText = result.response.text();
    }

    // Add the model's response to the history  
    chatHistories[sessionId].push({ role: "model", parts: [{ text: responseText }] });

    // Extract token usage information if available
    const tokensUsed = result.response.promptFeedback?.tokens || 
                      (result.response.metadata && result.response.metadata.tokensUsed) || 
                      "N/A";
    const tokensLeft = generationConfig.maxOutputTokens - (typeof tokensUsed === 'number' ? tokensUsed : 0);

    res.status(200).json({  
      response: responseText,  
      tokensUsed,  
      tokensLeft: tokensLeft >= 0 ? tokensLeft : "N/A",  
    });

  } catch (error) {
    console.error("Error generating AI response:", error);
    // Log more detailed error for debugging
    if (error.response) {
      console.error("API response error:", error.response.data);
    }
    res.status(500).json({ error: "Failed to generate response." });
  }
};
