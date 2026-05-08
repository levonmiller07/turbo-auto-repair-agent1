const { OpenAI } = require('openai');
const { DateTime } = require('luxon');
const fs = require('fs');

// This is a simple chat agent implementation that uses the same logic as the voice assistant
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const assistantConfig = JSON.parse(fs.readFileSync('./assistant-config.json'));

async function handleChat(message, history = []) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: assistantConfig.model.messages[0].content },
      ...history,
      { role: "user", content: message }
    ],
    tools: assistantConfig.model.tools.map(t => ({
      type: "function",
      function: t.function
    }))
  });

  const assistantMessage = response.choices[0].message;
  
  if (assistantMessage.tool_calls) {
    // In a real implementation, you would call the tool handlers from server.js here
    // and then call OpenAI again with the results.
    return { 
      type: 'tool_call', 
      calls: assistantMessage.tool_calls 
    };
  }

  return { 
    type: 'text', 
    content: assistantMessage.content 
  };
}

module.exports = { handleChat };
