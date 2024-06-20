  const {OpenAiAPIKey} = require('./common');

const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: OpenAiAPIKey // This is also the default, can be omitted
});


Parse.Cloud.define("openAiCompletion", async request => {
  if (!request.user)
    throw 'Must be signed in to call this Cloud Function.';

  if (!OpenAiAPIKey)
    throw "OpenAI API key not configured!";

  const {prompt} = request.params;
  if (!prompt)
    throw 'There is no prompt param!';

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          "role": "user",
          "content": prompt
        }
      ],
      temperature: 0.6,
      max_tokens: 200
    });
    console.log(JSON.stringify(completion, null, 2));
    return completion.choices[0];
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    } else {
      throw `Error with OpenAI API request: ${error.message}`;
    }
  }
});