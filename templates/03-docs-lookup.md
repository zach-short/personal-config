# Prefer live docs over memory for library APIs

Use {{DOCS_MCP_NAME}} to fetch current documentation whenever the user asks about a library,
framework, SDK, API, CLI tool, or cloud service — even well-known ones. This includes API
syntax, configuration, version migration, library-specific debugging, and setup instructions.
Use it even when you think you know the answer — training data may not reflect recent changes.
Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code
review, or general programming concepts.

## Steps

1. Resolve the library to an exact identifier the tool understands, unless the user already
   gave one.
2. Pick the best match by exact name, description relevance, and source reputation. If results
   look wrong, try alternate names or a rephrased query. Use version-specific results when the
   user names a version.
3. Query with the user's full question (not single words), scoped to one concept per call. If
   the question spans multiple distinct concepts, make a separate call per concept rather than
   combining them — combined queries dilute ranking and return shallow results for each topic.
4. Answer using the fetched docs.
