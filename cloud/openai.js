const {OpenAiAPIKey} = require('./common');

const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: OpenAiAPIKey,
});
const openai = new OpenAIApi(configuration);




async function generate(req, res) {
  if (!configuration.apiKey) {
    res.status(500).json({
      error: {
        message: "OpenAI API key not configured, please follow instructions in README.md",
      }
    });
    return;
  }

  const prompt = req.body.prompt || '';
  if (prompt.trim().length === 0) {
    res.status(400).json({
      error: {
        message: "Please enter a valid prompt",
      }
    });
    return;
  }

  try {
    const completion = await openai.createCompletion({
      model: "text-davinci-003",
      prompt,
      temperature: 0.6,
    });
    res.status(200).json({ result: completion.data.choices[0].text });
  } catch(error) {
    // Consider adjusting the error handling logic for your use case
    if (error.response) {
      console.error(error.response.status, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`);
      res.status(500).json({
        error: {
          message: 'An error occurred during your request.',
        }
      });
    }
  }
}

Parse.Cloud.define("openAiCompletion", async request => {
  if (!request.user)
    throw 'Must be signed in to call this Cloud Function.';

  if (!configuration.apiKey)
    throw "OpenAI API key not configured!";

  const {prompt} = request.params;
  if (!prompt)
    throw 'There is no prompt param!';

  try {
    const completion = await openai.createCompletion({
      model: "text-davinci-003",
      prompt,
      temperature: 0.6,
    });
    return completion.data.choices[0].text;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    } else {
      throw `Error with OpenAI API request: ${error.message}`;
    }
  }
});