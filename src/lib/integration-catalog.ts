import type { IntegrationToolkit } from "@/lib/types";

// Composio serves a logo per toolkit slug at a fixed URL scheme, so the catalog below can resolve
// app icons without a remote round-trip. Live search results carry their own `logo` from the API.
export function composioLogoUrl(slug: string) {
  return `https://logos.composio.dev/api/${slug}`;
}

function toolkit(
  slug: string,
  name: string,
  description: string,
  authSchemes: string[] = ["OAUTH2"]
): IntegrationToolkit {
  return {
    slug,
    name,
    description,
    logo: composioLogoUrl(slug),
    enabled: true,
    isNoAuth: false,
    authSchemes,
  };
}

// Static first-paint catalog for the Browse tab. Live Agent37/Composio search still runs for typed
// queries (the full 1,000+ app catalog), but the default grid should not wait on a remote request.
// Forkers can curate this list freely — it is purely the "popular apps" starting set.
export const DEFAULT_INTEGRATION_TOOLKITS: IntegrationToolkit[] = [
  toolkit("googledrive", "Google Drive", "Google Drive stores and shares cloud files."),
  toolkit("googledocs", "Google Docs", "Google Docs is a collaborative document editor."),
  toolkit("googlecalendar", "Google Calendar", "Google Calendar helps manage schedules and events."),
  toolkit("gmail", "Gmail", "Gmail is Google's email service."),
  toolkit("slack", "Slack", "Slack is a team messaging and collaboration hub."),
  toolkit("notion", "Notion", "Notion centralizes notes, docs, wikis, and tasks."),
  toolkit("airtable", "Airtable", "Airtable merges spreadsheets with databases."),
  toolkit("googlesheets", "Google Sheets", "Google Sheets is a cloud spreadsheet tool."),
  toolkit("googletasks", "Google Tasks", "Google Tasks helps track tasks and to-dos."),
  toolkit("github", "GitHub", "GitHub is a code hosting platform."),
  toolkit("discord", "Discord", "Discord connects communities and chat servers."),
  toolkit("linear", "Linear", "Linear tracks issues and product work."),
  toolkit("jira", "Jira", "Jira tracks bugs, issues, and project work."),
  toolkit("figma", "Figma", "Figma supports collaborative design workflows."),
  toolkit("outlook", "Outlook", "Outlook is Microsoft's email and calendar platform."),
  toolkit("hubspot", "HubSpot", "HubSpot manages CRM, marketing, and sales workflows."),
  toolkit("twitter", "Twitter", "Twitter connects posts, profiles, and social data."),
  toolkit("supabase", "Supabase", "Supabase is an open-source backend platform.", ["API_KEY"]),
  toolkit("perplexityai", "Perplexity AI", "Perplexity AI provides conversational answer search.", ["API_KEY"]),
  toolkit("youtube", "YouTube", "YouTube hosts and manages video content."),
  toolkit("serpapi", "SerpApi", "SerpApi provides real-time search results.", ["API_KEY"]),
  toolkit("firecrawl", "Firecrawl", "Firecrawl automates web crawling and extraction.", ["API_KEY"]),
  toolkit("tavily", "Tavily", "Tavily offers search and data retrieval for agents.", ["API_KEY"]),
  toolkit("codeinterpreter", "Code Interpreter", "Code Interpreter runs Python and data analysis tasks.", []),
];
