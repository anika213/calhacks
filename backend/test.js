// ESM (recommended). If you use CommonJS, replace the import with: 
// const OpenAI = require("openai").default;
const OpenAI = require("openai").default;

const client = new OpenAI({
  apiKey: "calhacks2047",
  baseURL: "https://janitorai.com/hackathon"
});

async function main() {
  try {
    const completion = await client.chat.completions.create({
      model: "x2", // same as your Python example
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello!" }
      ]
    });

    console.log(completion.choices)
  } catch (err) {
    console.error("API error:", err);
  }
}

main();
