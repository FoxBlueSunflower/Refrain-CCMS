export interface TourStep {
  title: string
  body: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to Refrain',
    body: "Your docs are markdown files in your folder. Cancel nothing, export nothing — you already have everything. This sample workspace shows how snippets, variables, and conditions work together.",
  },
  {
    title: 'Variables',
    body: 'Open "Getting Started" and look for {{product_name}} — that\'s a variable. Edit its value once in the Variables panel and it updates everywhere it\'s used.',
  },
  {
    title: 'Snippets',
    body: 'The warning box in "Installing AcmeCloud" is a snippet, written once and included with {{> warning-banner}}. Change the snippet, and every document that includes it changes too — check Where-used to see them all.',
  },
  {
    title: 'Publish',
    body: 'When you\'re ready, hit Publish to build a static HTML site from your docs. Every publish is saved to History, with a changelog and one-click restore.',
  },
]
