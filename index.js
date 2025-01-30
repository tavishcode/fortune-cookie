import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const schema = {
  properties: {
    reasoning: { title: "Reasoning", type: "string" },
    score: { title: "Score", type: "number" },
    finalMessage: { title: "finalMessage", type: "string" },
  },
  required: ["reasoning", "score", "finalMessage"],
  title: "ResponseSchema",
  type: "object",
};
const jsonSchema = JSON.stringify(schema, null, 4);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Hello, World!" });
});

app.post("/fortune", async (req, res) => {
  try {
    const { theme } = req.body;
    if (!theme || (theme !== "wholesome" && theme !== "dark")) {
      return res
        .status(400)
        .json({ error: 'Theme must be either "wholesome" or "dark"' });
    }

    const prompt = `Generate a single, short, and unique fortune cookie message that will make someone both laugh and think.

    Theme: ${
      theme === "wholesome"
        ? "Write an encouraging message that's refreshingly original. Think supportive friend energy, but with an unexpected twist that makes it memorable. The tone should be warm but never saccharine, with subtle humor that enhances rather than undermines the positivity."
        : "Create a playfully savage observation about daily life, personal habits, or human nature. The message should be cleverly critical but avoid overused topics (NO browser history, phone addiction, or social media jokes). Think the perfect mix of psychological insight and playful callout that makes someone feel seen in an uncomfortable way."
    }
    
    To ensure quality, follow these steps:
    
    1. First, generate 3-4 candidate messages following these guardrails:
       - Max 15 words (shorter = better)
       - Must avoid: browser history, internet habits, phone use, or social media jokes
       - Should focus on: personality quirks, daily habits, self-perception, life choices
       - Must include a specific, concrete observation (no vague platitudes)
       - Humor should come from psychological insight, not technological references
       
    2. Then, score each candidate on:
       - Originality (1-5): How unique and unexpected is it?
       - Memorability (1-5): Would someone want to share this?
       - Voice (1-5): Does it sound authentically human?
       - Impact (1-5): Does it land emotionally (wholesome) or comedically (savage)?
    
    3. Finally:
       - Pick the candidate with the highest total score
       - Make one final polish pass to tighten the language
       - Ensure it stays under 15 words while maintaining impact
       - Output the final message in JSON following this schema: ${jsonSchema}
    
    Remember:
    - Focus on universal human experiences and behaviors
    - Dark humor should come from uncomfortable truths, not tech-related embarrassment
    - The best messages feel both personal and universal
    - When in doubt, be more specific and concrete
    
    Example wholesome messages: 
    - "Your houseplants secretly appreciate your apologies after forgetting to water them."
    - "Even your microwave enjoys watching you dance while waiting for food."
    - "That weird childhood hobby you loved? It's still proud of you."
    
    Example dark messages: 
    - "That perfect comeback you practiced in the shower still wouldn't have worked."
    - "Your 'organized chaos' system is just regular chaos with better marketing."
    - "Your self-proclaimed good taste is mostly just expensive taste."
    
    IMPORTANT: Your final output must be a single JSON object following this exact schema: ${jsonSchema}
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 1,
      response_format: { type: "json_object" },
    });

    let fortune;
    let finalMessage;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        fortune = chatCompletion.choices[0]?.message?.content;
        finalMessage = JSON.parse(fortune).finalMessage;
        break; // Exit loop if parsing is successful
      } catch (parseError) {
        console.error(`Parsing attempt ${attempts + 1} failed:`, parseError);
        attempts += 1;
        if (attempts >= maxAttempts) {
          return res
            .status(500)
            .json({
              error: "Failed to parse fortune message after multiple attempts",
            });
        }
      }
    }

    res.json({ finalMessage });
  } catch (error) {
    console.error("Error querying GroqCloud:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
