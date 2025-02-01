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

// Helper to clean the response text (e.g. remove markdown code fences)
function cleanJSONResponse(responseText) {
  const trimmed = responseText.trim();
  if (trimmed.startsWith("```")) {
    const parts = trimmed.split("\n");
    // Remove the first line (possibly containing "```json") and the last line if they start with ```
    if (parts[0].startsWith("```")) parts.shift();
    if (parts[parts.length - 1].startsWith("```")) parts.pop();
    return parts.join("\n").trim();
  }
  return responseText;
}

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

    // Helper: returns random elements from an array.
    function getRandomElements(arr, count = 3) {
      if (arr.length < count) {
        throw new Error("Array length is smaller than the requested count.");
      }
      let shuffled = arr.slice(); // Create a copy of the array
      for (let i = shuffled.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // Swap elements
      }
      return shuffled.slice(0, count);
    }

    const WHOLESOME_FOCUS_AREAS = [
      // Everyday Magic
      "Dancing shadows on morning walls",
      "Forgotten book margin doodles",
      "Wind-chime conversations",
      "Rain-pattern prophecies",
      "Sunset color recipes",
      "Cloud-watching revelations",

      // Personal Rituals
      "Midnight snack ceremonies",
      "Morning stretch symphonies",
      "Tea-steeping meditations",
      "Plant-watering dialogues",
      "Bedtime blanket nests",
      "Window-watching wanderlust",

      // Micro-Triumphs
      "Perfectly-timed puns",
      "Accidental skill discoveries",
      "Remembered dream fragments",
      "Spontaneous dance victories",
      "Serendipitous song moments",
      "Lucky sock adventures",

      // Inner Landscapes
      "Memory garden blooms",
      "Imagination hammocks",
      "Nostalgia time capsules",
      "Courage constellations",
      "Hope hibernation dens",
      "Wonder wavelengths",

      // Connection Points
      "Pet telepathy moments",
      "Stranger smile exchanges",
      "Library book messages",
      "Mirror self high-fives",
      "Phone call time warps",
      "Lost letter reunions",

      // Time Echoes
      "Childhood taste flashbacks",
      "Future self postcards",
      "Past wisdom whispers",
      "Tomorrow's laugh echoes",
      "Yesterday's courage seeds",
      "Next week's joy previews",
    ];

    const DARK_FOCUS_AREAS = [
      // Personal Pretense
      "Instagram life fabrications",
      "LinkedIn humble brags",
      "Wellness warrior theatrics",
      "Digital authenticity mirages",
      "Self-care performance pieces",
      "Mindfulness masquerades",

      // Modern Absurdities
      "Premium mediocrity pursuits",
      "Productivity porn addiction",
      "Artificial busyness syndrome",
      "Digital hoarding habits",
      "Convenience inconveniences",
      "First-world problem poetry",

      // Psychological Puzzles
      "Imposter syndrome acrobatics",
      "Procrastination art forms",
      "Anxiety architecture",
      "Decision paralysis dances",
      "Memory selective editing",
      "Emotional logic pretzels",

      // Social Theatrics
      "Small talk chess games",
      "Opinion recycling habits",
      "Friendship maintenance theater",
      "Social media method acting",
      "Group chat power plays",
      "Dating app illusions",

      // Life Management Comedy
      "Todo list graveyards",
      "Email inbox archaeology",
      "Calendar tetris tournaments",
      "Budget spreadsheet fiction",
      "Resolution amnesia patterns",
      "Habit tracker abandonments",

      // Identity Constructs
      "Personal brand mythology",
      "Career narrative fiction",
      "Lifestyle aesthetic theater",
      "Personality trait costumes",
      "Biography creative writing",
      "Self-improvement fairytales",
    ];

    // Build the system prompt
    const systemPrompt = `
Generate a single, short, and unique fortune cookie message that will make someone both laugh and think. Make this message distinctly different from any typical fortune cookie message by viewing it through the randomly assigned perspective, context, emotion, and angle below.
Theme: ${
      theme === "wholesome"
        ? "Create a delightfully uplifting message that celebrates the quirky, endearing aspects of being human. Think of it as a warm hug wrapped in a clever observation that makes someone smile and feel genuinely good about themselves. The tone should sparkle with playful wisdom and capture life's magical little moments."
        : "Create a playfully savage observation about daily life, personal habits, or human nature. The message should be cleverly critical but avoid overused topics (NO browser history, phone addiction, or social media jokes). Think the perfect mix of psychological insight and playful callout that makes someone feel seen in an uncomfortable way."
    }

Step-by-Step Creation Process:

1. IDEATION:
   Generate ideas based on this focus area: ${
     theme === "wholesome"
       ? getRandomElements(WHOLESOME_FOCUS_AREAS, 1)
       : getRandomElements(DARK_FOCUS_AREAS, 1)
   }

2. EVALUATION (Score each candidate)
   Rate each message on these criteria (1-5):
   - Freshness: Does it avoid these overused elements?
   - Emotional Impact: Does it create a strong feeling?
   - Craft: Is it well-constructed?

3. POLISHING:
   - Select highest-scoring message
   - Ensure every word serves a purpose
   - Check that tone matches theme

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
2. Ensure the message is exactly ONE message that matches the theme.
3. The message (in finalMessage) must be under 15 words.
`;

    const userPrompt = "Generate";

    // List of fallback models available on the GroqCloud free tier.
    // (The first model is the primary model; if a 429 is encountered, the next is used.)
    const fallbackModels = [
      "llama-3.3-70b-versatile",
      "llama3-70b-8192",
      "mixtral-8x7b-32768",
      "gemma2-9b-it",
      "llama-3.1-8b-instant",
      "llama3-8b-8192",
    ];

    const maxAttempts = 3;
    let finalMessageResponse = null;
    let lastError = null;

    // Try multiple attempts, cycling through fallback models if necessary.
    for (
      let attempt = 0;
      attempt < maxAttempts && !finalMessageResponse;
      attempt++
    ) {
      for (const model of fallbackModels) {
        try {
          const chatCompletion = await groq.chat.completions.create({
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: userPrompt,
              },
            ],
            model, // Use the current model from fallbackModels
            temperature: 1,
            response_format: { type: "json_object" },
          });

          let responseText = chatCompletion.choices[0]?.message?.content;
          if (!responseText) {
            throw new Error("Empty response from Groq API");
          }

          // Clean up the response (e.g. remove markdown code fences)
          responseText = cleanJSONResponse(responseText);

          // Try to parse the response
          const parsed = JSON.parse(responseText);

          // Validate the JSON schema
          if (
            typeof parsed !== "object" ||
            typeof parsed.reasoning !== "string" ||
            typeof parsed.score !== "number" ||
            typeof parsed.finalMessage !== "string"
          ) {
            throw new Error("Response JSON does not match the required schema");
          }

          // Check that finalMessage is under 15 words
          const wordCount = parsed.finalMessage.trim().split(/\s+/).length;
          if (wordCount >= 15) {
            throw new Error(
              `finalMessage contains ${wordCount} words (expected under 15 words)`
            );
          }

          // If we got here, the response is valid.
          finalMessageResponse = parsed;
          break; // Break out of the fallbackModels loop.
        } catch (error) {
          // If the error indicates a rate limit, log and try the next model.
          if (error.response && error.status === 429) {
            console.warn(
              `Rate limited using model ${model}: ${error.message}. Trying next model.`
            );
            continue;
          }
          console.error(`Error using model ${model}: ${error.message}`);
          lastError = error;
          // Continue to try the next model in fallbackModels.
        }
      }
      if (!finalMessageResponse) {
        // Wait a moment before retrying all models again.
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!finalMessageResponse) {
      throw (
        lastError ||
        new Error(
          "Failed to obtain a valid fortune response after multiple attempts"
        )
      );
    }

    // Return the details including prompts and the final response.
    res.json({
      systemPrompt: systemPrompt,
      userPrompt: userPrompt,
      response: finalMessageResponse,
    });
  } catch (error) {
    next(error); // Pass error to error handler
  }
});

// Register error handler
app.use(errorHandler);

// Store the server instance
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});
