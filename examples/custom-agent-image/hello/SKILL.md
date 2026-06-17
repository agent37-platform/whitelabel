---
name: hello
description: Greets someone with a friendly ASCII banner. Use when the user asks to say hello, greet someone, or wants a welcome message.
---

# Hello skill

This is an example skill. It shows how a skill baked into your image teaches the
agent a new behavior — replace it with your own.

A skill is a folder with a `SKILL.md`: YAML frontmatter (`name`, `description`) that
tells the agent when to reach for it, and a body that tells it what to do.

When the user asks you to greet someone, run:

```bash
cowsay "Hello from your own Agent37 image!"
```

Return the command's output.
