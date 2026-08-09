UPDATE "appSetting"
SET "agentModelId" = 'openai/gpt-5-nano',
    "agentModelContextWindow" = 400000
WHERE "agentModelId" = 'openai/gpt-5.5';
