"""Local browser-use agent for driving pkmn-rse-browser in a real browser.

First-time setup (run from this directory):
    cp .env.example .env                  # add ANTHROPIC_API_KEY
    uv sync                               # install Python deps
    uv run browser-use install            # install Playwright Chromium

Run:
    # 1. In another terminal at the repo root:  npm run dev
    # 2. From this directory:                   uv run python run_agent.py
    #
    # Override the task at runtime:
    #   BROWSER_AGENT_TASK="Start a new game and name the player ASH" uv run python run_agent.py
"""

import asyncio
import os

from browser_use import Agent, Browser, ChatAnthropic
from dotenv import load_dotenv

load_dotenv()

GAME_URL = os.environ.get("GAME_URL", "http://localhost:5173/pkmn-rse-browser/")
MODEL = os.environ.get("BROWSER_AGENT_MODEL", "claude-sonnet-4-6")
HEADLESS = os.environ.get("BROWSER_AGENT_HEADLESS", "false").lower() == "true"

DEFAULT_TASK = f"""
Open {GAME_URL} and wait for the Pokemon Emerald title screen WebGL canvas to render.
The game listens for keyboard input on the canvas — you may need to click the canvas first
to give it focus. Press Enter to advance past the title screen, then describe what you see
on the main menu.
""".strip()


async def main() -> None:
    task = os.environ.get("BROWSER_AGENT_TASK", DEFAULT_TASK)
    llm = ChatAnthropic(model=MODEL, temperature=0.0)
    browser = Browser(headless=HEADLESS)
    agent = Agent(task=task, llm=llm, browser=browser)
    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())
