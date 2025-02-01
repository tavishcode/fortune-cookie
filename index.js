import express, { response } from "express";
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

const FALLBACK_WHOLESOME = [
  "Your plant survived another week – you're basically a life wizard.",
  "That song you can't stop humming? It's humming you back.",
  "Your bed appreciates how well you make it, even on lazy days.",
  "Today's awkward moment will be next week's favorite story.",
  "Your coffee maker thinks you're the best part of waking up.",
  "That random dance move you invented? It's catching on somewhere.",
  "Even your backup plans have backup plans – you delightful overthinker.",
  "Your bookshelf quietly brags about your excellent taste.",
  "Your leftovers are living their best second-chance life.",
  "The blanket fort you built in third grade still stands in memory.",
  "Your sock drawer's organizational system is living poetry.",
  "That pun you made yesterday finally made someone laugh today.",
  "Your playlist could save the world, one shuffle at a time.",
  "The universe giggles every time you talk to yourself.",
  "Your morning bedhead is an avant-garde masterpiece.",
  "That weird filing system only you understand? Pure genius.",
  "Your signature dance move is studied by distant aliens.",
  "The snooze button admires your optimism.",
  "Your shower singing career is underrated.",
  "Even your typos have a certain charm.",
  "Your collection of unmatched socks forms a secret society.",
  "That recipe you improvised deserves its own cookbook.",
  "Your indoor plants spread rumors about your green thumb.",
  "The stars choreograph their dance to your heartbeat.",
  "Your favorite mug tells other cups about you.",
  "That childhood stuffed animal still guards your dreams.",
  "Your browser history tells an epic adventure story.",
  "The mirror practices your expressions when you're away.",
  "Your grocery lists are poetry in disguise.",
  "That fancy pen saves its best ink for you.",
  "Your phone's camera roll is a museum of moments.",
  "The kitchen dances when you cook at midnight.",
  "Your umbrella collection predicts beautiful storms.",
  "That half-finished project is plotting a comeback.",
  "Your desk chair spins tales of your brilliance.",
  "The calendar circles your name in golden light.",
  "Your footsteps leave echoes of possibility.",
  "That one sock you lost is living its best life.",
  "Your keys hide to spend more time with you.",
  "The wind whistles your forgotten melodies.",
  "Your coffee stains map adventures untold.",
  "That parallel parking job deserves an award.",
  "Your handwriting tells secrets in cursive whispers.",
  "The moon photographs your best side nightly.",
  "Your breakfast cereal arranges itself artistically.",
  "That deadline fears your determination.",
  "Your Netflix queue reveals hidden depths.",
  "The weekend plans itself around your smile.",
  "Your pencil sharpener collects brilliant thoughts.",
  "That houseplant grows from your kindness.",
  "Your weekend naps inspire epic dreams.",
  "The refrigerator light stays on for you.",
  "Your bike chain clicks in morse code compliments.",
  "That doodle in your notebook started a movement.",
  "Your kitchen spices trade stories about you.",
  "The washing machine dances to your laundry rhythm.",
  "Your bookmarks lead to treasure maps.",
  "That paper clip collection tells your story.",
  "Your tea leaves read themselves.",
  "The alarm clock delays for your dreams.",
  "Your sticky notes write love letters at night.",
  "That forgotten password remembers you fondly.",
  "Your garage door opens to possibility.",
  "The garden gnome guards your whimsy.",
  "Your email drafts compose secret symphonies.",
  "That misplaced glove waves from adventure.",
  "Your cookie jar keeps midnight secrets.",
  "The doorbell chimes your personal theme song.",
  "Your window view frames perfect moments.",
  "That empty journal page awaits your legend.",
  "Your coffee grounds read like stardust.",
  "The printer jams just to hear your voice.",
  "Your calendar doodles predict the future.",
  "That takeout fortune was meant for you.",
  "Your umbrella stand holds rain dances.",
  "The doormat collects stories with your footsteps.",
  "Your toast always lands butter-side up somewhere.",
  "That lost button adventures without you.",
  "Your shower thoughts solve universal puzzles.",
  "The microwave timer counts your victories.",
  "Your paperclips form chainmail of protection.",
  "That spare key opens parallel worlds.",
  "Your morning alarm dreams your dreams.",
  "The mirror keeps your best angles secret.",
  "Your bookshelf arranges itself by mood.",
  "That extra sock protects its missing twin.",
  "Your pencil marks map constellations.",
  "The ceiling fan spins your stories.",
  "Your doorknob turns golden at your touch.",
  "That chair remembers your perfect posture.",
  "Your calendar circles dance in harmony.",
  "The teapot whistles your favorite tune.",
  "Your phone charger powers possibilities.",
  "That wallet carries more than money.",
  "Your keys jingle victory songs.",
  "The curtains frame your daily epic.",
  "Your coffee cup rim wears your smile.",
  "That stamp collection travels while you sleep.",
  "Your shoelaces tie knots of adventure.",
  "The keyboard clicks code your destiny.",
  "Your headphones whisper tomorrow's songs.",
  "That pencil sharpener keeps your points bright.",
  "Your screen brightness adjusts to your brilliance.",
];

const FALLBACK_DARK = [
  "Your plant's death wasn't about forgetfulness—it was a commitment metaphor.",
  "That thing you're procrastinating? It's literally twenty minutes of work.",
  "Your 'healthy boundaries' are just walls painted in therapeutic buzzwords.",
  "The gym membership fees mock your optimism every month.",
  "Your emotional support water bottle can't hydrate away your problems.",
  "That playlist you're proud of is just other people's personalities.",
  "Your backup plans have backup plans, yet anxiety persists.",
  "The vegetables rotting in your fridge judge your life choices.",
  "Your self-care routine is just avoiding decisions in fancy packaging.",
  "That personality test result you quote isn't a personality substitute.",
  "Your extensive tea collection won't steep away life's complications.",
  "The unfinished projects in your closet formed a support group.",
  "Your grocery list optimism doesn't match your takeout reality.",
  "That motivational quote in your bio isn't fooling anyone.",
  "Your meditation app knows you're just napping.",
  "The empty journal collection mirrors your unwritten stories.",
  "Your cooking aspirations end at the chopping board.",
  "That relationship pattern isn't a coincidence anymore.",
  "Your houseplants have trust issues with you.",
  "The unused gift cards mock your good intentions.",
  "Your calendar's 'maybe' responses are just polite 'no's.",
  "That fancy coffee maker judges your instant coffee mornings.",
  "Your sustainable lifestyle has questionable Amazon habits.",
  "The unread books judge your Netflix queue.",
  "Your productivity system needs its own productivity system.",
  "That 'signature style' is just decision fatigue in disguise.",
  "Your indoor herb garden dreams of surviving past week two.",
  "The unopened mail knows your adulting struggles.",
  "Your morning routine aspirations mock your snooze button reality.",
  "That tidying system can't organize your thought chaos.",
  "Your recipe collection vastly exceeds your cooking attempts.",
  "The gym bag in your car has given up hope.",
  "Your podcast queue is longer than your attention span.",
  "That bucket list collects more dust than experiences.",
  "Your spiritual journey keeps circling the parking lot.",
  "The meal prep containers know they're future takeout vessels.",
  "Your reading list grows faster than your wisdom.",
  "That vision board needs its own vision board.",
  "Your self-improvement books need self-improvement.",
  "The empty canvas knows you're just a paint collector.",
  "Your networking strategy is avoiding eye contact professionally.",
  "That expensive hobby equipment questions your commitment.",
  "Your weekend plans consistently overestimate your energy.",
  "The forgotten passwords remember your memory claims.",
  "Your life hack collection needs a life hack.",
  "That empty freezer meal prep space mocks your intentions.",
  "Your DIY supplies have DIY commitment issues.",
  "The new year resolutions recognize their annual reunion.",
  "Your 'work-life balance' is just burnout in slow motion.",
  "That daily gratitude journal entry is three months old.",
  "Your budgeting app judges your 'treat yourself' philosophy.",
  "The yoga mat questions your flexibility claims.",
  "Your time management needs time management.",
  "That emergency fund knows it's the vacation budget.",
  "Your skincare routine complexity masks simple neglect.",
  "The reusable bags forget their store visits.",
  "Your inbox organization system needs therapy.",
  "That networking event smile isn't fooling anyone.",
  "Your decision-making process needs decisions made about it.",
  "The forgotten languages app speaks disappointment fluently.",
  "Your five-year plan is creative fiction.",
  "That home organization project spawned three more.",
  "Your charging cable collection could power a small city.",
  "The weekly meal plan surrendered to reality.",
  "Your career path looks more like modern art.",
  "That focus timer knows about your tab-switching habit.",
  "Your new hobby supplies formed a retirement community.",
  "The workshop refund policy knows you well.",
  "Your cleaning schedule is more aspirational than functional.",
  "That resume skills section is optimistically creative.",
  "Your self-improvement paradoxically increases self-criticism.",
  "The filing system created its own chaos theory.",
  "Your future self keeps leaving tasks for future-future self.",
  "That wellness routine needs wellness.",
  "Your shopping cart saves are just digital window shopping.",
  "The meeting notes doodles tell the real story.",
  "Your productivity peak was just caffeine timing.",
  "That sock drawer organization lasted three days.",
  "Your creative process involves mainly procrastination.",
  "The multiple calendars multiply your confusion.",
  "Your habit tracker needs a habit tracker.",
  "That personal brand is just anxiety with a filter.",
  "Your project management style is chaos with deadlines.",
  "The workout playlist outlasts your workouts.",
  "Your contact list needs archaeological excavation.",
  "That digital detox always starts tomorrow.",
  "Your recipe modifications are just ingredient absences.",
  "The meditation pillow knows it's just decor.",
  "Your auto-replies are more consistent than your habits.",
  "That garage organization project entered year three.",
  "Your sleep schedule is more guideline than rule.",
  "The reminder apps remind you to check reminder apps.",
  "Your sustainable swaps can't offset those plane tickets.",
  "That portfolio update is seasonally procrastinated.",
  "Your task categorization system needs categorization.",
  "The bookmark folders are digital hoarding evidence.",
  "Your professional development is Netflix documentary-based.",
  "That morning pages journal questions your definition of morning.",
  "Your life admin needs administrative assistance.",
  "The side hustle needs a side hustle.",
  "Your backup storage is full of duplicate duplicates.",
  "That creative rut dug itself deeper.",
];

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
  console.error("Error handler caught an error:", err.stack);
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
    console.log("Received /fortune request with body:", req.body);

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error("Validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { theme } = req.body;
    console.log(`Request theme: ${theme}`);

    // Helper: returns random elements from an array.
    function getRandomElements(arr, count = 1) {
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
    console.log("Constructed system prompt.");

    // List of fallback models available on the GroqCloud free tier.
    // (The first model is the primary model; if a 429 is encountered or a non-rate-limit error occurs 3 times, the next is used.)
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

    // Iterate through each model.
    for (const model of fallbackModels) {
      console.log(`Trying model: ${model}`);
      let attempts = 0;
      while (attempts < maxAttempts && !finalMessageResponse) {
        attempts++;
        console.log(`Model ${model} - Attempt ${attempts} of ${maxAttempts}`);
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
            model, // Use the current model
            temperature: 1,
            response_format: { type: "json_object" },
          });

          let responseText = chatCompletion.choices[0]?.message?.content;
          if (!responseText) {
            throw new Error("Empty response from Groq API");
          }
          console.log(
            `Raw response from model ${model} (attempt ${attempts}): ${responseText.slice(
              0,
              200
            )}...`
          );

          // Clean up the response (e.g. remove markdown code fences)
          responseText = cleanJSONResponse(responseText);
          console.log(
            `Cleaned response from model ${model}: ${responseText.slice(
              0,
              200
            )}...`
          );

          // Try to parse the response
          const parsed = JSON.parse(responseText);
          console.log(`Parsed JSON from model ${model}:`, parsed);

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
          console.log(
            `Valid response obtained from model ${model} on attempt ${attempts}. theme: ${theme} finalMessage: "${parsed.finalMessage}"`
          );
        } catch (error) {
          // If a rate limit error is encountered, stop retrying this model.
          if (error instanceof Groq.APIError && error.status === 429) {
            console.log(
              `Rate limited using model ${model} on attempt ${attempts}: ${error.message}. Switching to next model.`
            );
            break; // Exit the inner loop for this model
          }
          lastError = error;
          console.error(
            `Error using model ${model} on attempt ${attempts}: ${error.message}`
          );
        }
      }
      if (finalMessageResponse) {
        console.log(
          `Exiting model loop; valid response obtained from model ${model}.`
        );
        break;
      } else {
        console.log(
          `No valid response from model ${model} after ${attempts} attempt(s). Moving to next model.`
        );
      }
    }

    if (!finalMessageResponse) {
      console.error("All models exhausted. Last error:", lastError);
      console.log(
        "Returning random hard-coded fortune as all LLM calls failed."
      );
      const randomFortune =
        theme == "wholesome"
          ? getRandomElements(FALLBACK_WHOLESOME, 1)
          : getRandomElements(FALLBACK_DARK, 1);
      res.json({
        response: {
          finalMessage: randomFortune,
        },
      });
    } else {
      // Return the details including prompts and the final response.
      console.log("Returning final response to client.");
      res.json({
        systemPrompt: systemPrompt,
        userPrompt: userPrompt,
        response: finalMessageResponse,
      });
    }
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
