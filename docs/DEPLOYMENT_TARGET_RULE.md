# Deployment Target Rule

Before any deploy or publish step, confirm the actual deployment target for the current project.

## Rule

Do not assume Base44 is the deployment target.

A project may use:
- GitHub only
- Vercel
- Netlify
- Base44
- Local/manual deployment
- Another custom flow

## Required Before Deploy

Before running deploy/publish commands, record:

| Field | Value |
|---|---|
| Project | |
| Branch | |
| Latest commit | |
| Deployment target | |
| Deploy command / platform action | |
| Requires login? | |
| Requires user approval? | |

## Safety

If the deployment target is unclear:
- stop
- ask the user
- do not run deploy commands

## Session Closure

Every session closure file must state:

```text
Deploy: N/A — not required
```

or the actual deployment target and its status. Never leave deployment status ambiguous.
