# OPTIONAL — your own Agent37 agent image (the opt-in "bake it into the image" path).
#
# DORMANT by default. The Starter Kit ships running on the built-in system
# templates (`agent37-hermes` / `agent37-openclaw`) — zero Docker, zero GHCR. You
# only need this folder if you want to bake something into your OWN image (a system
# package, a CLI, a skill, custom config). Most forks never touch it.
#
# This is the SIMPLE path: fork the FULL Hermes image, so the managed model + the
# gateway (chat API) work out of the box — you just add your bits on top. If you'd
# rather bring your OWN model (point the agent at your own LLM via a tiny proxy),
# see the more advanced example in `examples/custom-agent-image/`.
#
# The contract (keep all four or the image won't run):
#   - build for linux/amd64  (on Apple Silicon, buildx with --platform=linux/amd64;
#     `npm run release:agent` already passes it)
#   - keep the image <= 5 GB compressed
#   - bake into /usr/local or /opt, never /home/node or /home/linuxbrew
#     (both are persistent volumes that mask anything baked there at runtime)
#   - keep the base ENTRYPOINT (it starts Hermes + the gateway that serves chat)
#   - install as root, end as USER node
#
# Publish: the pushed image must be PUBLIC on GHCR (Agent37 pulls it anonymously).
# After editing this file, run `npm run release:agent` (build + push + register the
# workspace template). See template/release.sh for the exact steps.

# The base Hermes tag is injected at build time — release.sh resolves the newest
# date tag from GHCR and passes --build-arg HERMES_TAG=<tag>, so each release pins a
# concrete, immutable tag. The :latest default is only a convenience for ad-hoc
# `docker build` runs without the arg; override with --build-arg HERMES_TAG=YYYY.MM.DD[x].
ARG HERMES_TAG=latest
FROM ghcr.io/agent37-platform/hermes:${HERMES_TAG}

USER root

# --- Add your customizations here (OPTIONAL) -------------------------------------
# Install as root, into /usr/local or /opt (NOT /home — it's a masked volume).
# A skill is a folder with a SKILL.md baked into the default-skills dir; the base
# entrypoint copies it into ~/.hermes/skills on boot.
#
# Example — install a system package:
# RUN sudo apt-get update \
#  && sudo apt-get install -y --no-install-recommends <pkg> \
#  && rm -rf /var/lib/apt/lists/*
#
# Example — bake a skill:
# COPY my-skill /usr/local/share/agent37/default-skills/my-skill
# ---------------------------------------------------------------------------------

# Re-expose Hermes' surfaces on NON-reserved ports. The control plane rejects custom
# templates that declare the reserved 3737/7681/8080/9119 (and exposes only the ports
# the template declares), so we remap. The stock entrypoint honors these env overrides.
# The gateway/data-plane port is set by the platform from the template's default port
# (3738 in release.sh), so it needs no env var here — only EXPOSE for documentation.
ENV AGENT37_TERMINAL_PORT=7682 \
    AGENT37_HERMES_DASHBOARD_PORT=9120 \
    AGENT37_FILEBROWSER_PORT=8081

# Documentation only (the platform routes the declared template ports): gateway,
# terminal, dashboard, files. These match the ports in template/release.sh.
EXPOSE 3738 7682 9120 8081

# Keep the base ENTRYPOINT (do NOT override it — it starts Hermes + the gateway).
USER node
