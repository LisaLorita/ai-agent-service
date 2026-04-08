const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config();

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  try {
    const result = await genAI.getGenerativeModel({ model: modelName }).generateContent("Hola");
    console.log("Response:", result.response.text());
  } catch (e) {
    console.error(`Error with ${modelName}:`, e.message);
  }
}

listModels();
