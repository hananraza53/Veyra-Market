# Veyra Market

A MERN portfolio marketplace priced in Pakistani rupees. The React and TypeScript storefront includes a 35-department category navigator, product comparison, wishlist, variant-aware cart, buyer accounts, seller fulfillment, admin tools and a catalog-grounded shopping assistant.

## Run the portfolio preview locally

Install Node.js 22.12 or later. From this directory run:

    npm ci
    npm run demo

Open the local address printed by Vite. Demo checkout saves orders in the current browser. Account verification and password reset require a connected server and mail provider.

## Run the connected marketplace

Copy .env.example to .env. Configure MongoDB with transaction support, the application secret, your SMTP sender and an AI provider key. Launch the backend and frontend in two terminals:

    npm run api
    npm run dev

The frontend development server forwards /api requests to port 3001. Keep provider secrets on the server. Use a verified sender for MAIL_FROM and a TLS-enabled SMTP provider. Gmail recipients can receive the verification and reset codes regardless of the SMTP provider you choose. Generate APP_SECRET locally with node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))".

For a new connected installation, register and verify your own account first. In your own MongoDB database, update that user record in the users collection to set its role to admin. Only the database owner should perform this bootstrap step. Applications from other accounts can then be approved in Admin → Seller applications. In the static demo, open Sell on Veyra to explore the sample seller and admin workspaces.

## Vercel

Import the repository into Vercel, choose the Vite preset, build with npm run build, and use dist as the output. The API entry point is api/index.ts. Configure server environment variables in project settings and redeploy. Leave VITE_DEMO_MODE unset for a connected deployment.

## Catalog and images

The seed catalog combines editorial demo products with imported product records. PKR pricing, promotions, stock, ratings and fulfillment are demonstration data. Catalog imagery includes third-party URLs. Product images may become unavailable and product metadata quality varies by source. Product images, brand names and trademarks retain their respective owners. Review image rights before commercial use.

## Motion and navigation

Internal navigation uses React Router Link and client-side routes. Route bundles load on demand. Lenis uses autoRaf, a 1.5-second duration and a 1.5 wheel multiplier; reduced-motion settings preserve native scroll. The initial loading bar and route skeletons disappear when content is ready.

## Conversational AI on your computer

Install and start Ollama and run `ollama pull qwen2.5:3b` once. Start `npm run ai:local` in the project folder, then start `npm run demo` in a second terminal. The assistant uses the local model for conversation and retrieves Veyra catalog and policy information. Public shopping questions work without MongoDB. Private order lookup needs the connected database and a signed-in buyer. If no model service is reachable, the chat identifies its fallback as Offline store guide.

### Hosted Ask Veyra

For local testing, keep using npm run ai:local with Ollama. For Vercel, set AI_API_KEY in the project's server-side Production environment. The default cloud configuration is AI_BASE_URL=https://api.openai.com/v1 and AI_MODEL=gpt-4o-mini. An OpenAI API account with available credit is required for this provider. Deploy after saving the variables. Visitors can chat when the developer laptop is off. Never put the provider key in a VITE_ variable. To test the same cloud settings before deployment, put them in .env and run npm run api alongside npm run demo.
