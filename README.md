# ConfigureFlow Frontend Task

## The Scenario

Welcome to ConfigureFlow! You've just joined as a frontend developer, and things are... interesting.

Our senior developer, Marcus, left the company rather suddenly last week. He was the primary maintainer of our core `ProductConfigurator` component—the heart of our embeddable product customization widget that our B2B clients use on their e-commerce sites.

**The situation:** We have a major client demo in 2 weeks, and there's a backlog of tickets that need attention. Your job is to triage these tickets, fix the critical issues, and get the component stable.

Marcus was a talented developer, but he had some... unconventional practices. The code works (mostly), but there are bugs that customers have reported, and the codebase could use some love.

## Your Assignment

You have approximately **4 hours** to:

1. **Review the codebase** - Understand how the ProductConfigurator works
2. **Triage the tickets** - See `TICKETS.md` for the backlog. Not everything can be fixed in 4 hours — prioritize wisely
3. **Fix what you can** - Focus on what matters most for the client demo
4. **Document your work** - Use `SUBMISSION_TEMPLATE.md` as a guide

## What We're Looking For

This isn't a trick question exercise. We want to see how you work in a realistic scenario:

- **Debugging skills** - Can you find the root cause of issues?
- **Prioritization** - Can you identify what's critical vs. nice-to-have?
- **Code quality** - Are your fixes clean and maintainable?
- **Communication** - Can you explain what you found and why you made certain decisions?
- **Product thinking** - Do you consider the end-user experience?

## Project Structure

```
├── src/
│   ├── components/
│   │   └── ProductConfigurator/
│   │       ├── ProductConfigurator.tsx    # The main component (~800 lines)
│   │       ├── types.ts                   # TypeScript types
│   │       └── styles.css                 # Component styles
│   ├── hooks/
│   │   └── usePriceCalculation.ts        # Custom hook for pricing
│   ├── services/
│   │   └── api.ts                        # Mock API service
│   ├── utils/
│   │   └── pricing.ts                    # Pricing utilities
│   └── data/
│       └── mockProduct.ts                # Sample product data
├── TICKETS.md                            # Your backlog of issues
├── CONTEXT.md                            # Business context & glossary
└── SUBMISSION_TEMPLATE.md                # Template for your submission
```

## Getting Started

### Prerequisites

- Node.js 22.13+ (24 LTS recommended — see `.nvmrc`, run `nvm use` if you use nvm)
- pnpm (or npm/yarn)

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# The app will be available at http://localhost:5173
```

### Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Type-check and build for production
- `pnpm lint` - Run ESLint
- `pnpm preview` - Preview production build

## Important Context

Before diving into the code, please read:

1. **`CONTEXT.md`** - Background on ConfigureFlow, the product, and key terminology
2. **`TICKETS.md`** - The backlog of issues you need to triage

## Submission

When you're done:

1. Create a new branch with your changes
2. Fill out `SUBMISSION_TEMPLATE.md` with your analysis
3. Create a Pull Request using the provided template
4. Make sure your PR includes:
   - Your code changes
   - Completed submission template
   - Any questions or clarifications needed

### Git & working style

Treat this like a real project. We care about good git hygiene — atomic commits, readable history, meaningful commit messages. A single mega-commit won't disqualify you, but well-sliced work is a strong signal. How you split the work is up to you; we judge the result (history, atomicity), not conformance to a specific flow.

## Questions?

In a real scenario, you'd have access to your team for questions. For this exercise:

- If something is genuinely ambiguous, note it in your submission
- If you need to make an assumption, document it
- If tickets contradict each other, that's intentional—make a judgment call and explain your reasoning

## Time Management

4 hours is not enough to fix everything. That's intentional. We want to see how you prioritize under constraints. A candidate who fixes 3 critical bugs well is more impressive than one who makes shallow passes at 10 issues.

---

Good luck! We're excited to see how you approach this challenge.
