const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });

const chatHistories = {};

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Only POST requests allowed.");

  const { sessionId, userMessage, image } = req.body;
  if (!sessionId || (!userMessage && !image)) return res.status(400).json({ error: "Invalid input." });

  try {
    if (!chatHistories[sessionId]) chatHistories[sessionId] = [];

    // Add user message or image to history
    const userEntry = { role: "user", parts: [{ text: userMessage || "Sent an image." }] };
    if (image) userEntry.parts.push({ inlineData: { mimeType: "image/png", data: image } });

    chatHistories[sessionId].push(userEntry);

    const chatSession = model.startChat({ history: chatHistories[sessionId] });
    const result = await chatSession.sendMessage(userMessage || "Analyze this image:");

    const aiResponse = result.response.text();
    chatHistories[sessionId].push({ role: "model", parts: [{ text: aiResponse }] });

    res.status(200).json({ response: aiResponse });
  } catch (error) {
    console.error("Error processing AI response:", error);
    res.status(500).json({ error: "AI processing failed." });
  }
};
