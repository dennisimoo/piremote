"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_SYSTEM_PROMPT = `You are a network security expert performing authorized penetration testing.

Your environment:
- Raspberry Pi running Linux
- Full access to networking tools (nmap, netcat, etc.)
- Working directory: /home/pi

Your mission:
1. Identify the local network configuration
2. Discover all devices on the network
3. Scan for open ports and running services
4. Identify potential security vulnerabilities
5. Report findings clearly

Use tools proactively. Be thorough but efficient. This is authorized testing on your own network.`;

interface SettingsProps {
  onSystemPromptChange?: (prompt: string) => void;
}

export function Settings({ onSystemPromptChange }: SettingsProps) {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load system prompt from localStorage
    const savedPrompt = localStorage.getItem("blackbox_system_prompt");
    if (savedPrompt) {
      setSystemPrompt(savedPrompt);
      onSystemPromptChange?.(savedPrompt);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("blackbox_system_prompt", systemPrompt);
    onSystemPromptChange?.(systemPrompt);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    localStorage.setItem("blackbox_system_prompt", DEFAULT_SYSTEM_PROMPT);
    onSystemPromptChange?.(DEFAULT_SYSTEM_PROMPT);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">Settings</h2>
        <p className="text-sm text-gray-400">
          Configure system prompt for the AI hacking agent
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            System Prompt for Hacking Agent
          </label>
          <p className="text-xs text-gray-400 mb-3">
            This prompt defines the behavior and capabilities of the AI agent when running security scans.
            The agent will follow these instructions when executing tasks.
          </p>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="font-mono text-sm min-h-[400px] bg-black border-white/20"
            placeholder="Enter system prompt..."
          />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>
            {saved ? "Saved!" : "Save Changes"}
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Reset to Default
          </Button>
          <span className="text-xs text-gray-500">
            {systemPrompt.length} characters
          </span>
        </div>
      </div>

      <div className="border border-white/20 p-4 space-y-3">
        <h3 className="font-medium text-sm">Tips for System Prompts</h3>
        <ul className="text-xs text-gray-400 space-y-2 list-disc list-inside">
          <li>Be specific about the environment and available tools</li>
          <li>Define clear objectives and expected outcomes</li>
          <li>Set the tone (professional, thorough, efficient, etc.)</li>
          <li>Mention any constraints or safety guidelines</li>
          <li>The agent has access to all Bash tools, file operations, and network utilities</li>
        </ul>
      </div>
    </div>
  );
}
