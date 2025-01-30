import express from "express";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ["GROQ_API_KEY", "NODE_ENV"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.set("trust proxy", 1);

// Security middleware
app.use(helmet()); // Add security headers
app.use(express.json({ limit: "10kb" })); // Limit payload size

// CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Define different rate limits for different types of endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const baseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // More lenient limit for basic endpoints
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting globally with a more lenient limit
app.use(baseLimiter);

// Apply stricter rate limiting to specific endpoints
app.use("/fortune", strictLimiter);

// Force HTTPS in production
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.header("x-forwarded-proto") !== "https") {
      res.redirect(`https://${req.header("host")}${req.url}`);
    } else {
      next();
    }
  });
}

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

// Custom error handler
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message,
  });
};

// Request validation middleware
const validateFortuneRequest = [
  body("theme")
    .isString()
    .isIn(["wholesome", "dark"])
    .withMessage('Theme must be either "wholesome" or "dark"'),
];

app.get("/", (req, res) => {
  res.json({ message: "Hello, World!" });
});

app.post("/fortune", validateFortuneRequest, async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { theme } = req.body;

    const prompt = `Generate a single, short, and unique fortune cookie message that will make someone both laugh and think.

Theme: ${
      theme === "wholesome"
        ? "Create a delightfully uplifting message that celebrates the quirky, endearing aspects of being human. Think of it as a warm hug wrapped in a clever observation that makes someone smile and feel genuinely good about themselves. The tone should sparkle with playful wisdom and capture life's magical little moments."
        : "Create a playfully savage observation about daily life, personal habits, or human nature. The message should be cleverly critical but avoid overused topics (NO browser history, phone addiction, or social media jokes). Think the perfect mix of psychological insight and playful callout that makes someone feel seen in an uncomfortable way."
    }

Step-by-Step Creation Process:

1. IDEATION (Generate 4 candidates)
   - First, take a deep breath and let your creativity flow
   - For each candidate, pick a different focus area:
     Wholesome Mode Areas:
     - Unexpected daily joys
     - Personal growth moments
     - Connection with objects/nature
     - Acts of self-kindness
     
     Dark Mode Areas:
     - Personal contradictions
     - Daily self-deceptions
     - Aspirational facades
     - Decision-making patterns

2. EVALUATION (Score each candidate)
   Rate each message on these criteria (1-5):
   - Freshness: Does it avoid these overused elements?
     AVOID:
     - "Your FBI agent..."
     - "Your future self..."
     - Generic inspiration
     INCLUDE:
     - Specific, novel observations
     
   - Emotional Impact: Does it create a strong feeling?
     AVOID:
     - Vague platitudes
     - Forced humor
     INCLUDE:
     - Genuine insight
     - Relatable moment
     
   - Craft: Is it well-constructed?
     AVOID:
     - Over 15 words
     - Abstract concepts
     INCLUDE:
     - Concrete details
     - Smooth flow

3. POLISHING
   - Select highest-scoring message
   - Ensure every word serves a purpose
   - Check that tone matches theme
   - Format as JSON per schema: ${jsonSchema}

STRONG Examples (Wholesome):
+ "The plants on your windowsill tell stories about your growing heart."
+ "Your midnight snack adventures make the kitchen feel less lonely."
+ "Each time you giggle at your own joke, a star gets brighter."
+ "The universe collects the tiny victories you forget to celebrate."

WEAK Examples (Wholesome):
- "Your awkwardness is actually cute" (backhanded)
- "Good things come to those who wait" (cliché)
- "You're doing better than you think!" (generic)
- "Keep pushing through the hard times" (vague)

STRONG Examples (Dark):
+ "Your color-coded planner can't organize away your commitment issues."
+ "That personality trait you're proud of? Just a well-marketed flaw."
+ "Your 'minimalist aesthetic' is just expensive empty space."
+ "Your emergency fund knows it's really your impulse shopping budget."

WEAK Examples (Dark):
- "Your browser history..." (overused tech joke)
- "Your phone knows..." (tech-focused)
- "You'll die alone" (too harsh)
- "Nobody likes you" (not clever)

IMPORTANT: 
1. Your final output must be a single JSON object following this schema: ${jsonSchema}
2. Ensure the message is exactly ONE message that matches the theme
3. Keep it under 15 words
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
        if (!fortune) {
          throw new Error("Empty response from Groq API");
        }
        finalMessage = JSON.parse(fortune).finalMessage;
        break;
      } catch (parseError) {
        console.error(`Parsing attempt ${attempts + 1} failed:`, parseError);
        attempts += 1;
        if (attempts >= maxAttempts) {
          throw new Error(
            "Failed to parse fortune message after multiple attempts"
          );
        }
      }
    }

    res.json({ finalMessage });
  } catch (error) {
    next(error); // Pass error to error handler
  }
});

// Register error handler
app.use(errorHandler);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  app.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});
