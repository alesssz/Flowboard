// Sample board rendered until the API serves boards.
import type { Board } from '@flowboard/shared';

export const sampleBoard: Board = {
  id: 'sample',
  title: 'Website relaunch',
  columns: [
    {
      id: 'todo',
      title: 'To do',
      color: 'gray',
      cards: [
        {
          id: 'pricing-copy',
          title: 'Write the pricing page copy',
          description:
            'Three plans, a comparison table and the FAQ. Legal reviews the refund wording before it goes live, and support checks that the answers match the help centre.',
        },
        { id: 'hero', title: 'Pick the hero illustration', description: '' },
        {
          id: 'redirects',
          title: 'Redirect the old URLs',
          description: 'Every old path maps to its new page, so search rankings carry over.',
        },
        {
          id: 'cookies',
          title: 'Cookie banner',
          description: 'Essential cookies only by default; analytics after consent.',
        },
      ],
    },
    {
      id: 'in-progress',
      title: 'In progress',
      color: 'coral',
      cards: [
        {
          id: 'navigation',
          title: 'Navigation redesign',
          description: 'Mobile menu first, then the desktop one.',
        },
        {
          id: 'blog',
          title: 'Move the blog to the new CMS',
          description: '142 posts. Images keep their alt text; drafts stay unpublished.',
        },
      ],
    },
    { id: 'blocked', title: 'Blocked', color: 'red', cards: [] },
    {
      id: 'review',
      title: 'Review',
      color: 'blue',
      cards: [
        {
          id: 'contact-form',
          title: 'Contact form',
          description: 'Validation messages and the confirmation state.',
        },
      ],
    },
    {
      id: 'done',
      title: 'Done',
      color: 'green',
      cards: [
        { id: 'brand', title: 'Brand colours and type scale', description: '' },
        {
          id: 'analytics',
          title: 'Analytics plan',
          description: 'Events for sign-up, trial start and plan change.',
        },
      ],
    },
  ],
};
